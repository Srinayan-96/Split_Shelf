const Notification = require('../models/Notification');
const { resolveTurn } = require('./turn.service');
const { DAY_MS } = require('./prediction.service');

const same = (a, b) => String(a) === String(b);

// ---------- builders (pure: no DB, easy to test) ----------

// Someone tapped "running low".
//  - the person whose turn it is gets YOUR_TURN ("it's your turn to buy it")
//  - everyone else gets ITEM_LOW ("Sri marked it low")
//  - the person who tapped gets nothing, since they know
function buildItemLowNotifications({ item, memberIds, actorId, actorName }) {
  const turnId = resolveTurn(item.nextTurn, item.lastBoughtBy, memberIds);
  const stamp = item.lowMarkedAt.getTime(); // identifies THIS low episode

  return memberIds
    .filter((id) => !same(id, actorId))
    .map((userId) => {
      const isTurn = turnId && same(userId, turnId);
      const type = isTurn ? 'YOUR_TURN' : 'ITEM_LOW';
      return {
        user: userId,
        household: item.household,
        item: item._id,
        type,
        message: isTurn
          ? `${item.name} is running low and it's your turn to buy it`
          : `${actorName} marked ${item.name} as running low`,
        dedupeKey: `${type}:low:${item._id}:${stamp}`,
      };
    });
}

function describeTiming(predictedRunOutAt, now) {
  const days = Math.ceil((predictedRunOutAt.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return 'is probably running out today';
  if (days === 1) return 'is predicted to run out tomorrow';
  return `is predicted to run out in about ${days} days`;
}

// The daily job found an item that will run out soon.
// Predictions are automatic and can be wrong, so we do NOT ping the whole house:
// only the person whose turn it is. (If nobody's turn can be worked out, tell everyone.)
function buildRunOutSoonNotifications({ item, memberIds, now = new Date() }) {
  const turnId = resolveTurn(item.nextTurn, item.lastBoughtBy, memberIds);
  const when = describeTiming(item.predictedRunOutAt, now);
  // One alert per buying cycle: the key contains the last purchase time, which
  // stays the same all cycle, so running the job every day never repeats it.
  const cycle = item.lastBoughtAt ? new Date(item.lastBoughtAt).getTime() : 0;

  if (turnId) {
    return [
      {
        user: turnId,
        household: item.household,
        item: item._id,
        type: 'YOUR_TURN',
        message: `${item.name} ${when}. It's your turn to buy it.`,
        dedupeKey: `YOUR_TURN:soon:${item._id}:${cycle}`,
      },
    ];
  }
  return memberIds.map((userId) => ({
    user: userId,
    household: item.household,
    item: item._id,
    type: 'RUN_OUT_SOON',
    message: `${item.name} ${when}.`,
    dedupeKey: `RUN_OUT_SOON:soon:${item._id}:${cycle}`,
  }));
}

// ---------- inserting ----------

// Bulk insert that silently skips duplicates. Duplicates are not errors here:
// they mean "this person was already told about this exact event".
async function insertNotifications(docs) {
  if (docs.length === 0) return 0;
  try {
    const inserted = await Notification.insertMany(docs, { ordered: false });
    return inserted.length;
  } catch (err) {
    // ordered:false = keep going after a failure. If EVERY failure was a
    // duplicate-key error, the rest were inserted fine and we're done.
    const writeErrors = err.writeErrors || [];
    const onlyDuplicates = writeErrors.length > 0 && writeErrors.every((e) => e.code === 11000);
    if (!onlyDuplicates) throw err;
    return docs.length - writeErrors.length;
  }
}

async function notifyItemLow({ household, item, actorId, actorName }) {
  const memberIds = household.members.map((m) => m.user);
  return insertNotifications(buildItemLowNotifications({ item, memberIds, actorId, actorName }));
}

module.exports = {
  buildItemLowNotifications,
  buildRunOutSoonNotifications,
  insertNotifications,
  notifyItemLow,
};