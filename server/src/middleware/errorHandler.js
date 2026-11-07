const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises an error handler by its 4 arguments; keep `next` even if unused.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Something went wrong';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err.code === 11000) {
    // MongoDB unique index violation, e.g. email already registered.
    status = 409;
    message = `Already exists: ${Object.keys(err.keyPattern || {}).join(', ')}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  // Only unexpected errors get logged loudly; the client never sees internals.
  if (status === 500) console.error(err);

  res.status(status).json({ success: false, message, ...(details && { details }) });
}

module.exports = { notFound, errorHandler };