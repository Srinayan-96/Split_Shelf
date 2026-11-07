const mongoose = require('mongoose');

// One tiny document per job: "this job is claimed until <time>".
const jobLockSchema = new mongoose.Schema(
  { _id: String, lockedUntil: { type: Date, required: true } },
  { versionKey: false }
);

module.exports = mongoose.model('JobLock', jobLockSchema);