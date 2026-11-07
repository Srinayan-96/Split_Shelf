const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

// Controllers stay thin: take input, call the service, send output.
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, ...result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ success: true, ...result });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.userId);
  res.json({ success: true, user });
});

module.exports = { register, login, me };