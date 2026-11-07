const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/notification.service');
const { listQuerySchema } = require('../validators/notification.validators');

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query); // a bad query throws ZodError -> 400
  const result = await service.listNotifications(req.userId, query);
  res.json({ success: true, ...result });
});

const unreadCount = asyncHandler(async (req, res) => {
  res.json({ success: true, unreadCount: await service.countUnread(req.userId) });
});

const read = asyncHandler(async (req, res) => {
  await service.markRead(req.userId, req.params.id);
  res.json({ success: true });
});

const readAll = asyncHandler(async (req, res) => {
  await service.markAllRead(req.userId);
  res.json({ success: true });
});

module.exports = { list, unreadCount, read, readAll };