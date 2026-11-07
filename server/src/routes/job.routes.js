const crypto = require('crypto');
const router = require('express').Router();
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { runWithLock } = require('../jobs/restockReminder.job');

// Compare hashes of both values: timingSafeEqual needs equal lengths, and it
// stops response time from leaking how much of a guess was right.
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
const secretMatches = (given) =>
  crypto.timingSafeEqual(digest(given ?? ''), digest(env.CRON_SECRET));

router.post(
  '/reminders',
  asyncHandler(async (req, res) => {
    // If no secret is configured the endpoint doesn't exist at all.
    if (!env.CRON_SECRET) throw ApiError.notFound('Route not found');
    if (!secretMatches(req.headers['x-cron-secret'])) {
      throw ApiError.unauthorized('Invalid cron secret');
    }
    // `null` means another run already took today's lock: not an error.
    const result = await runWithLock();
    res.json({ success: true, result });
  })
);

module.exports = router;
