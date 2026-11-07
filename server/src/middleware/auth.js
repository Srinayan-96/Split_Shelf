const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

// Protects a route. After this runs, req.userId is the logged-in user's id.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    // Pin the algorithm. Without this, a forged token that claims "alg: none"
    // or a different algorithm could slip through on some library versions.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err); // JsonWebTokenError / TokenExpiredError -> 401 in errorHandler
  }
}

module.exports = { requireAuth };