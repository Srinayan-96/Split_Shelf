const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { runRestockReminders } = require('./restockReminder.job');

(async () => {
  await connectDB();
  console.log(await runRestockReminders()); // bypasses the lock on purpose
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});