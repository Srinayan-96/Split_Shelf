const Household = require('../models/Household');
const Item = require('../models/Item');
const RestockLog = require('../models/RestockLog');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { generateInviteCode } = require('../utils/inviteCode');

const { MAX_MEMBERS } = Household;
const MAX_CODE_RETRIES = 5;

const ALREADY_IN = 'You are already in a household. Leave it first.';

// Shape sent to the client. Only names are exposed, never emails of roommates.
function toPublicHousehold(h) {
  return {
    id: h._id,
    name: h.name,
    inviteCode: h.inviteCode,
    maxMembers: MAX_MEMBERS,
    members: h.members.map((m) => ({
      id: m.user._id,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  };
}

async function withMembers(household) {
  await household.populate('members.user', 'name');
  return toPublicHousehold(household);
}

// ---------- CREATE ----------
async function createHousehold(userId, { name }) {
  // Friendly early error. The REAL guarantee is the unique index on members.user.
  if (await Household.exists({ 'members.user': userId })) throw ApiError.conflict(ALREADY_IN);

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    try {
      const household = await Household.create({
        name,
        inviteCode: generateInviteCode(),
        members: [{ user: userId, role: 'admin' }],
      });
      return await withMembers(household);
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Two possible unique-index failures. Which one?
      if (err.keyPattern?.['members.user']) throw ApiError.conflict(ALREADY_IN); // double-tap race
      // Otherwise the invite code collided with an existing one: loop, new code.
    }
  }
  throw new ApiError(500, 'Could not generate an invite code, please try again');
}

// ---------- JOIN ----------
async function joinHousehold(userId, { inviteCode }) {
  if (await Household.exists({ 'members.user': userId })) throw ApiError.conflict(ALREADY_IN);

  try {
    // THE key step. ONE atomic operation that says:
    //   "find the household with this code, but ONLY if it has room,
    //    and ONLY if I'm not already in it, then add me."
    // MongoDB applies a single-document update atomically. Two people
    // grabbing the last seat run one after the other: the second one's
    // condition ("fewer than 10 members") is now false, so it matches nothing.
    const household = await Household.findOneAndUpdate(
      {
        inviteCode,
        'members.0': { $exists: true },                       // not an empty, half-deleted household
        'members.user': { $ne: userId },                      // not already a member of THIS one
        $expr: { $lt: [{ $size: '$members' }, MAX_MEMBERS] }, // fewer than 10 members
      },
      { $push: { members: { user: userId, role: 'member', joinedAt: new Date() } } },
      { new: true }
    );
    if (household) return await withMembers(household);
  } catch (err) {
    // Joined two DIFFERENT households at the same instant: the unique index on
    // members.user lets one through and rejects the other.
    if (err.code === 11000) throw ApiError.conflict(ALREADY_IN);
    throw err;
  }

  // Nothing matched. Now (after the fact, only to pick the message) work out why.
  const existing = await Household.findOne({ inviteCode }).select('members');
  if (!existing || existing.members.length === 0) throw ApiError.notFound('Invalid invite code');
  if (existing.members.length >= MAX_MEMBERS) {
    throw ApiError.conflict(`This household is full (max ${MAX_MEMBERS} members)`);
  }
  throw ApiError.conflict('Could not join, please try again');
}

// ---------- VIEW MINE ----------
async function getMyHousehold(userId) {
  const household = await Household.findOne({ 'members.user': userId }).populate(
    'members.user',
    'name'
  );
  // Not in one yet is a normal state, not an error. The frontend shows onboarding.
  return household ? toPublicHousehold(household) : null;
}

// ---------- LEAVE ----------
async function leaveHousehold(userId, householdId, options = {}) {
  const { action, newAdminUserId } = options;

  const current = await Household.findOne({ _id: householdId, 'members.user': userId });
  if (!current) throw ApiError.notFound('Household not found');

  const me = current.members.find((m) => String(m.user) === String(userId));
  const isAdmin = me?.role === 'admin';

  // Option A: Admin explicitly deletes the household and all its data
  if (action === 'delete') {
    if (!isAdmin) {
      throw ApiError.forbidden('Only an admin can delete the household.');
    }
    await Household.deleteOne({ _id: householdId });
    await deleteHouseholdData(householdId);
    await Notification.deleteMany({ household: householdId });
    return { deleted: true };
  }

  // Option B: Admin reassigns admin role to another member before leaving
  if (newAdminUserId && String(newAdminUserId) !== String(userId)) {
    const targetMember = current.members.find((m) => String(m.user) === String(newAdminUserId));
    if (!targetMember) {
      throw ApiError.badRequest('Selected member is not part of this household.');
    }
    await Household.updateOne(
      { _id: householdId, 'members.user': newAdminUserId },
      { $set: { 'members.$.role': 'admin' } }
    );
  }

  // Step 1: remove me. Atomic, and only matches if I'm actually a member.
  const household = await Household.findOneAndUpdate(
    { _id: householdId, 'members.user': userId },
    { $pull: { members: { user: userId } } },
    { new: true }
  );
  if (!household) throw ApiError.notFound('Household not found');

  // My alerts for this household are meaningless now.
  await Notification.deleteMany({ user: userId, household: householdId });

  // Step 2a: I was the last one -> delete the household and its data.
  if (household.members.length === 0) {
    // "Only if STILL empty" in the filter protects against someone joining in between.
    const res = await Household.deleteOne({ _id: householdId, members: { $size: 0 } });
    if (res.deletedCount === 1) await deleteHouseholdData(householdId);
    return { deleted: true };
  }

  // Step 2b: others remain. Make sure at least one admin does too. This update
  // only matches when NO member is an admin, and then promotes the longest-standing
  // member (members is in join order, so index 0). It's safe to run twice, and
  // it repairs the state if two admins leave at the same moment.
  await Household.updateOne(
    { _id: householdId, 'members.role': { $ne: 'admin' } },
    { $set: { 'members.0.role': 'admin' } }
  );

  return { left: true };
}

async function deleteHouseholdData(householdId) {
  // Find the item ids first, then delete logs and notifications BY ITEM ID.
  // Those queries use an index. RestockLog has no index on household, so
  // deleting by household would scan the whole collection.
  const items = await Item.find({ household: householdId }).select('_id').lean();
  const itemIds = items.map((i) => i._id);

  await Promise.all([
    RestockLog.deleteMany({ item: { $in: itemIds } }),
    Notification.deleteMany({ item: { $in: itemIds } }),
    Item.deleteMany({ household: householdId }),
  ]);
}

// ---------- NEW INVITE CODE (admin) ----------
// Use when a code leaked, or after removing someone who still has the old one.
async function regenerateInviteCode(householdId) {
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    try {
      const household = await Household.findOneAndUpdate(
        { _id: householdId },
        { $set: { inviteCode: generateInviteCode() } },
        { new: true }
      ).populate('members.user', 'name');
      if (!household) throw ApiError.notFound('Household not found');
      return toPublicHousehold(household);
    } catch (err) {
      if (err.code !== 11000) throw err; // code collided: try another
    }
  }
  throw new ApiError(500, 'Could not generate an invite code, please try again');
}

module.exports = {
  createHousehold,
  joinHousehold,
  getMyHousehold,
  leaveHousehold,
  regenerateInviteCode,
};