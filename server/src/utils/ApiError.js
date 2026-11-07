// An error we throw on purpose, carrying the HTTP status to send back.
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }

  static badRequest(msg = 'Bad request')   { return new ApiError(400, msg); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden')       { return new ApiError(403, msg); }
  static notFound(msg = 'Not found')        { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict')         { return new ApiError(409, msg); }
}

module.exports = ApiError;