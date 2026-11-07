const cron = require('node-cron');
const Item = require('../models/Item');
const Household = require('../models/Household');
const { env } = require('../config/env');
const { DAY_MS } = require('../services/prediction.service');
const {
  buildRunOutSoonNotifications,
  insertNotifications,
} = require('../services/notifier.service');
const { acquireLock, releaseLock } = require('../utils/jobLock');

const JOB_NAME = 'restock-reminders';
const WARN_DAYS = 3;   // alert when run-out is predicted within 3 days
const GRACE_DAYS = 2;  // ...or was predicted up to 2 days ago. Older = we're probably not tracking it.
const CHUNK_SIZE = 500;
const LOCK_TTL_MS = 20 * 60 * 60 * 1000; // 20h: covers "all instances fire within seconds of each other"

// The actual work. Safe to run any number of times: the unique dedupeKey index
// guarantees nobody gets the same alert twice.
async function runRestockReminders(now = new Date()) {
  const query = {
    status: 'ok', // if someone already tapped "low", they've been alerted by a human
    predictedRunOutAt: {
      $type: 'date', // makes the query match the partial index; check with explain()
      $gte: new Date(now.getTime() - GRACE_DAYS * DAY_MS),
      $lte: new Date(now.getTime() + WARN_DAYS * DAY_MS),
    },
  };

  // A cursor STREAMS the results instead of loading every item into memory.
  const cursor = Item.find(query).sort({ predictedRunOutAt: 1 }).batchSize(CHUNK_SIZE).lean().cursor();

  let chunk = [];
  let scanned = 0;
  let created = 0;

  for await (const item of cursor) {
    chunk.push(item);
    if (chunk.length >= CHUNK_SIZE) {
      created += await processChunk(chunk, now);
      scanned += chunk.length;
      chunk = [];
    }
  }
  if (chunk.length > 0) {
    created += await processChunk(chunk, now);
    scanned += chunk.length;
  }

  return { scanned, created };
}

// 500 items -> ONE query for their households, ONE bulk insert. Never one query per item.
async function processChunk(items, now) {
  const householdIds = [...new Set(items.map((i) => String(i.household)))];
  const households = await Household.find({ _id: { $in: householdIds } })
    .select('members')
    .lean();
  const membersByHousehold = new Map(households.map((h) => [String(h._id), h.members]));

  const docs = [];
  for (const item of items) {
    const members = membersByHousehold.get(String(item.household));
    if (!members) continue; // household was deleted meanwhile
    docs.push(
      ...buildRunOutSoonNotifications({ item, memberIds: members.map((m) => m.user), now })
    );
  }
  return insertNotifications(docs);
}

// What cron calls: claim the job first so only one instance does the scan.
async function runWithLock() {
  if (!(await acquireLock(JOB_NAME, LOCK_TTL_MS))) {
    console.log('[reminders] another instance is handling today\'s run, skipping');
    return null;
  }
  try {
    const result = await runRestockReminders();
    console.log('[reminders] finished', result);
    return result; // on success we KEEP the lock, so late-firing instances skip
  } catch (err) {
    await releaseLock(JOB_NAME); // on failure, free it so a retry can take over
    throw err;
  }
}

function startRestockReminderJob() {
  if (!cron.validate(env.REMINDER_CRON)) {
    throw new Error(`Invalid REMINDER_CRON: "${env.REMINDER_CRON}"`);
  }
  const task = cron.schedule(
    env.REMINDER_CRON,
    async () => {
      try {
        await runWithLock();
      } catch (err) {
        console.error('[reminders] run failed', err); // never crash the server over a job
      }
    },
    { timezone: env.CRON_TIMEZONE }
  );
  console.log(`[reminders] scheduled "${env.REMINDER_CRON}" (${env.CRON_TIMEZONE})`);
  return task;
}

module.exports = { startRestockReminderJob, runRestockReminders, runWithLock };