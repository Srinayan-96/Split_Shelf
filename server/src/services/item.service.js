const Item = require('../models/Item');
const RestockLog = require('../models/RestockLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { computePrediction, RECENT_PURCHASES_USED, DAY_MS } = require('./prediction.service');
const { pickNextTurn, resolveTurn } = require('./turn.service');
const notifier = require('./notifier.service');

const MAX_ITEMS_PER_HOUSEHOLD = 100; // keeps lists small, so no pagination needed
const HISTORY_LIMIT = 20;
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- helpers: turning DB documents into API responses ----------

// One query gets every member's name (at most 10). Items and logs only store
// user ids, and this lets us show names without a populate per field.
async function loadContext(household) {
  const memberIds = household.members.map((m) => m.user);
  const users = await User.find({ _id: { $in: memberIds } }).select('name').lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return { names, memberIds };
}

function toPublicItem(item, { names, memberIds }) {
  // A user who left isn't in `names`, so they show as "Former member".
  const person = (id) => (id ? { id, name: names.get(String(id)) || 'Former member' } : null);
  const turnId = resolveTurn(item.nextTurn, item.lastBoughtBy, memberIds);

  return {
    id: item._id,
    name: item.name,
    unit: item.unit,
    status: item.status,
    lowMarkedBy: person(item.lowMarkedBy),
    lowMarkedAt: item.lowMarkedAt,
    lastBoughtBy: person(item.lastBoughtBy),
    lastBoughtAt: item.lastBoughtAt,
    nextTurn: person(turnId),
    purchaseCount: item.purchaseCount ?? 0,
    forecastGaps: item.forecastGaps ?? 0,
    avgIntervalDays: item.avgIntervalDays,
    predictedRunOutAt: item.predictedRunOutAt,
    // Negative means "predicted to have run out already".
    daysLeft: item.predictedRunOutAt
      ? Math.ceil((item.predictedRunOutAt.getTime() - Date.now()) / DAY_MS)
      : null,
  };
}

// Low items first, then soonest to run out, then A-Z. At most 100 items, so sorting in JS is fine.
function sortForDashboard(items) {
  const rank = (i) => (i.status === 'low' ? 0 : 1);
  const when = (i) => (i.predictedRunOutAt ? i.predictedRunOutAt.getTime() : Infinity);
  return items.sort(
    (a, b) => rank(a) - rank(b) || when(a) - when(b) || a.nameKey.localeCompare(b.nameKey)
  );
}

// ---------- LIST ----------
async function listItems(household) {
  const [items, ctx] = await Promise.all([
    Item.find({ household: household._id }),
    loadContext(household),
  ]);
  return sortForDashboard(items).map((i) => toPublicItem(i, ctx));
}

// ---------- CREATE ----------
async function createItem(household, { name, unit }) {
  // Soft limit. Two simultaneous requests could overshoot by a couple, which is harmless.
  const count = await Item.countDocuments({ household: household._id });
  if (count >= MAX_ITEMS_PER_HOUSEHOLD) {
    throw ApiError.badRequest(`A household can track at most ${MAX_ITEMS_PER_HOUSEHOLD} items`);
  }

  try {
    const item = await Item.create({ household: household._id, name, unit: unit || undefined });
    return toPublicItem(item, await loadContext(household));
  } catch (err) {
    // Unique index on (household, nameKey): "Dish soap" vs "dish soap " collide here.
    if (err.code === 11000) throw ApiError.conflict(`"${name}" is already on your shelf`);
    throw err;
  }
}

// ---------- DETAIL + HISTORY ----------
async function getItemDetail(household, itemId) {
  const item = await Item.findOne({ _id: itemId, household: household._id });
  if (!item) throw ApiError.notFound('Item not found');

  const [logs, ctx] = await Promise.all([
    RestockLog.find({ item: item._id }).sort({ boughtAt: -1 }).limit(HISTORY_LIMIT),
    loadContext(household),
  ]);

  return {
    item: toPublicItem(item, ctx),
    history: logs.map((l) => ({
      id: l._id,
      boughtBy: {
        id: l.boughtBy,
        name: ctx.names.get(String(l.boughtBy)) || 'Former member',
      },
      boughtAt: l.boughtAt,
      intervalDays: l.intervalDays,
      quantity: l.quantity ?? 1,
      pricePaise: l.pricePaise ?? null,
      note: l.note || null,
    })),
  };
}

// ---------- "RUNNING LOW" ----------
async function markLow(household, itemId, userId) {
  // Atomic: flips ok -> low ONLY if it is currently ok. If three roommates tap
  // at once, exactly one request matches this filter. The others match nothing.
  const updated = await Item.findOneAndUpdate(
    { _id: itemId, household: household._id, status: 'ok' },
    { $set: { status: 'low', lowMarkedBy: userId, lowMarkedAt: new Date() } },
    { new: true }
  );
  const ctx = await loadContext(household);

  if (updated) {
    // Runs only for the ONE request that really flipped ok -> low.
    // Alerts are best-effort: the status change already succeeded, so a failure
    // here is logged but must not turn the user's tap into an error.
    try {
      await notifier.notifyItemLow({
        household,
        item: updated,
        actorId: userId,
        actorName: ctx.names.get(String(userId)) || 'Someone',
      });
    } catch (err) {
      console.error('Failed to send low-item notifications', err);
    }
    return { item: toPublicItem(updated, ctx), changed: true };
  }

  // Nothing matched: either no such item, or it was already low. Tapping twice is not an error.
  const existing = await Item.findOne({ _id: itemId, household: household._id });
  if (!existing) throw ApiError.notFound('Item not found');
  return { item: toPublicItem(existing, ctx), changed: false };
}

// ---------- "I BOUGHT THIS" ----------
async function markBought(
  household,
  itemId,
  userId,
  { idempotencyKey, boughtAt, quantity, pricePaise, note }
) {
  const item = await Item.findOne({ _id: itemId, household: household._id });
  if (!item) throw ApiError.notFound('Item not found');

  const when = boughtAt || new Date();

  // STEP 1: record the purchase in the log. The log is the source of truth.
  let log;
  let replayed = false;
  try {
    const previous = await RestockLog.findOne({ item: item._id, boughtAt: { $lt: when } })
      .sort({ boughtAt: -1 })
      .select('boughtAt');

    log = await RestockLog.create({
      household: household._id,
      item: item._id,
      boughtBy: userId,
      boughtAt: when,
      intervalDays: previous ? round2((when - previous.boughtAt) / DAY_MS) : null,
      quantity: quantity === undefined ? undefined : Math.round(quantity * 1000) / 1000,
      pricePaise: pricePaise ?? null,
      note: note || undefined,
      idempotencyKey,
    });
  } catch (err) {
    // Same idempotencyKey seen before = a double-tap or a network retry.
    // We don't create a second purchase, we load the first one and carry on.
    const isReplay = err.code === 11000 && err.keyPattern?.idempotencyKey;
    if (!isReplay) throw err;
    replayed = true;
    log = await RestockLog.findOne({ item: item._id, idempotencyKey });
    if (!log) throw ApiError.conflict('Could not record purchase, please try again');
  }

  // STEP 2: apply the purchase to the item. Runs on replays too, on purpose: if
  // the server crashed after step 1 last time, the retry repairs the item.
  const updated = await applyPurchaseToItem(household, item._id, log);
  if (!updated) throw ApiError.notFound('Item not found'); // deleted while we worked

  // The item is restocked, so earlier "running low" / "your turn" alerts for it are stale.
  await Notification.updateMany({ item: itemId, readAt: null }, { $set: { readAt: new Date() } });

  return { item: toPublicItem(updated, await loadContext(household)), replayed };
}

async function applyPurchaseToItem(household, itemId, log) {
  const [recent, purchaseCount] = await Promise.all([
    RestockLog.find({ item: itemId })
      .sort({ boughtAt: -1 })
      .limit(RECENT_PURCHASES_USED)
      .select('boughtAt'),
    RestockLog.countDocuments({ item: itemId }),
  ]);
  const { avgIntervalDays, predictedRunOutAt, usableGaps } = computePrediction(
    recent.map((l) => l.boughtAt)
  );

  // These depend on the whole log, not on this one purchase, so they're always safe to write.
  await Item.updateOne(
    { _id: itemId },
    { $set: { avgIntervalDays, predictedRunOutAt, forecastGaps: usableGaps, purchaseCount } }
  );

  // The "current state" fields change only if this purchase is NEWER than the one
  // already recorded. That makes it:
  //  - safe to repeat (a replay has the same time, so it's not "newer": no-op)
  //  - correct when two roommates buy at nearly the same moment (the later purchase
  //    wins, whichever request happens to arrive last)
  //  - safe for backdated entries (they don't overwrite a more recent purchase)
  const memberIds = household.members.map((m) => m.user);
  const updated = await Item.findOneAndUpdate(
    { _id: itemId, $or: [{ lastBoughtAt: null }, { lastBoughtAt: { $lt: log.boughtAt } }] },
    {
      $set: {
        status: 'ok',
        lowMarkedBy: null,
        lowMarkedAt: null,
        lastBoughtBy: log.boughtBy,
        lastBoughtAt: log.boughtAt,
        nextTurn: pickNextTurn(memberIds, log.boughtBy),
      },
    },
    { new: true }
  );

  return updated || Item.findById(itemId); // null here means the item no longer exists
}

// ---------- DELETE (admin) ----------
async function deleteItem(household, itemId) {
  const res = await Item.deleteOne({ _id: itemId, household: household._id });
  if (res.deletedCount === 0) throw ApiError.notFound('Item not found');
  // If we crash between these lines, the leftover logs are unreachable and harmless.
  await Promise.all([
    RestockLog.deleteMany({ item: itemId }),
    Notification.deleteMany({ item: itemId }),
  ]);
}

module.exports = {
  listItems, createItem, getItemDetail, markLow, markBought, deleteItem, loadContext,
};