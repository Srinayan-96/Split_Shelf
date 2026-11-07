// Wraps an async route so a thrown error goes to our error handler
// instead of crashing the request or hanging forever.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;