// Usage: router.post('/x', validate(schema), handler)
// On success, req.body is REPLACED with the cleaned version (trimmed, lowercased),
// so handlers never see raw input. On failure, ZodError goes to the error handler (400).
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};

module.exports = validate;