const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const tooMany = (message) => ({ success: false, message });
const skipInTests = () => env.NODE_ENV === 'test';

// General limit per IP for the whole API.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many requests, slow down.'),
});

// Stricter for login/register. Only FAILED attempts count.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many attempts, try again later.'),
});

// Stops people guessing invite codes. Only WRONG codes count.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many attempts, try again later.'),
});

module.exports = { globalLimiter, authLimiter, joinLimiter };