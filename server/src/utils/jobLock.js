const JobLock = require('../models/JobLock');

// Returns true if THIS instance now owns the job, false if another one does.
// With 3 server instances all firing the cron at 08:00, exactly one gets true.
async function acquireLock(name, ttlMs) {
  const now = new Date();
  try {
    await JobLock.findOneAndUpdate(
      { _id: name, lockedUntil: { $lt: now } }, // free (expired)?
      { $set: { lockedUntil: new Date(now.getTime() + ttlMs) } },
      { upsert: true }
    );
    return true;
    // Cases:
    //  - no lock document yet  -> upsert inserts it: we own the job.
    //  - lock expired          -> filter matches, we take it over.
    //  - lock held by another  -> filter doesn't match, so upsert tries to INSERT
    //    a document with the same _id and MongoDB rejects it with a duplicate-key error.
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

async function releaseLock(name) {
  await JobLock.updateOne({ _id: name }, { $set: { lockedUntil: new Date(0) } });
}

module.exports = { acquireLock, releaseLock };