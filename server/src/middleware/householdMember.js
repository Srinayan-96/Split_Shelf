const Household = require('../models/Household');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Use on every route shaped like /households/:householdId/...
// Proves the logged-in user belongs to that household. After it runs:
//   req.household = the household (name + members)
//   req.member    = this user's entry in it ({ user, role, joinedAt })
const requireMember = asyncHandler(async (req, res, next) => {
  const household = await Household.findOne({
    _id: req.params.householdId,
    'members.user': req.userId,
  }).select('name members');

  // 404, not 403. Someone probing ids shouldn't learn which households exist.
  if (!household) throw ApiError.notFound('Household not found');

  req.household = household;
  req.member = household.members.find((m) => String(m.user) === String(req.userId));
  next();
});

// Use AFTER requireMember, for admin-only actions.
const requireAdmin = (req, res, next) => {
  if (req.member?.role !== 'admin') {
    return next(ApiError.forbidden('Only a household admin can do this'));
  }
  next();
};

module.exports = { requireMember, requireAdmin };