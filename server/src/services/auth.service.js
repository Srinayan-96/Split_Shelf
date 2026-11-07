const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

// Cost 12 = about 250ms per hash on a normal server. Slow on purpose: it makes
// guessing passwords from a stolen database very expensive.
const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

// A real hash of a throwaway password. See login() for why we need it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function signToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId), // becomes the "sub" claim = who this token belongs to
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// The only shape of a user the outside world ever sees. No hash, ever.
function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await User.create({ name, email, passwordHash });
    return { user: toPublicUser(user), token: signToken(user._id) };
  } catch (err) {
    // We do NOT check "does this email exist?" first, because two simultaneous
    // signups could both pass that check. We just insert and let the unique
    // index on email decide: exactly one wins, the other lands here.
    if (err.code === 11000) throw ApiError.conflict('An account with this email already exists');
    throw err;
  }
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  // Compare against a dummy hash when the user doesn't exist, so a wrong email
  // takes as long as a wrong password. Otherwise response time would reveal
  // which emails are registered.
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // One generic message for both cases, for the same reason.
  if (!user || !ok) throw ApiError.unauthorized('Invalid email or password');

  return { user: toPublicUser(user), token: signToken(user._id) };
}

async function getMe(userId) {
  const user = await User.findById(userId);
  // The token was valid but the account is gone (deleted after the token was issued).
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return toPublicUser(user);
}

module.exports = { register, login, getMe };