const mongoose = require('mongoose');
const app = require('./app');
const { env } = require('./config/env');
const { connectDB } = require('./config/db');
const { startRestockReminderJob } = require('./jobs/restockReminder.job');

async function start() {
  await connectDB();
  const server = app.listen(env.PORT, () => console.log(`API on port ${env.PORT}`));

  // The cron job starts here, never in app.js, so tests that import `app` don't start timers.
  const reminderTask = env.CRON_ENABLED ? startRestockReminderJob() : null;

  // On shutdown (deploys, scaling down), finish in-flight requests first.
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    reminderTask?.stop();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref(); // hard stop if something hangs
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});