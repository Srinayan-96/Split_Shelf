const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/household.service');

const create = asyncHandler(async (req, res) => {
  const household = await service.createHousehold(req.userId, req.body);
  res.status(201).json({ success: true, household });
});

const join = asyncHandler(async (req, res) => {
  const household = await service.joinHousehold(req.userId, req.body);
  res.json({ success: true, household });
});

const mine = asyncHandler(async (req, res) => {
  const household = await service.getMyHousehold(req.userId);
  res.json({ success: true, household }); // household is null if the user has none
});

const leave = asyncHandler(async (req, res) => {
  const result = await service.leaveHousehold(req.userId, req.params.householdId, req.body);
  res.json({ success: true, ...result });
});

const regenerateCode = asyncHandler(async (req, res) => {
  const household = await service.regenerateInviteCode(req.params.householdId);
  res.json({ success: true, household });
});

module.exports = { create, join, mine, leave, regenerateCode };