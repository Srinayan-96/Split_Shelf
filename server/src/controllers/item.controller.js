const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/item.service');

// requireMember (in the routes) already put req.household on the request.
const list = asyncHandler(async (req, res) => {
  const items = await service.listItems(req.household);
  res.json({ success: true, items });
});

const create = asyncHandler(async (req, res) => {
  const item = await service.createItem(req.household, req.body);
  res.status(201).json({ success: true, item });
});

const detail = asyncHandler(async (req, res) => {
  const result = await service.getItemDetail(req.household, req.params.itemId);
  res.json({ success: true, ...result });
});

const low = asyncHandler(async (req, res) => {
  const result = await service.markLow(req.household, req.params.itemId, req.userId);
  res.json({ success: true, ...result });
});

const bought = asyncHandler(async (req, res) => {
  const result = await service.markBought(req.household, req.params.itemId, req.userId, req.body);
  res.json({ success: true, ...result });
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteItem(req.household, req.params.itemId);
  res.json({ success: true });
});

module.exports = { list, create, detail, low, bought, remove };