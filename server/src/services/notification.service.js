const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');

function toPublic(n) {
  return {
    id: n._id,
    type: n.type,
    message: n.message,
    itemId: n.item,
    read: n.readAt !== null,
    createdAt: n.createdAt,
  };
}

// Cursor pagination: "give me the next page older than this id". Unlike page
// numbers, it never skips or repeats rows when new notifications arrive meanwhile.
async function listNotifications(userId, { unread, limit, before }) {
  const filter = { user: userId };
  if (unread === 'true') filter.readAt = null;
  if (before) filter._id = { $lt: before };

  const [docs, unreadCount] = await Promise.all([
    // Fetch one extra row only to learn whether another page exists.
    Notification.find(filter).sort({ _id: -1 }).limit(limit + 1),
    countUnread(userId),
  ]);

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);
  return {
    notifications: page.map(toPublic),
    nextCursor: hasMore ? page[page.length - 1]._id : null,
    unreadCount,
  };
}

function countUnread(userId) {
  return Notification.countDocuments({ user: userId, readAt: null });
}

async function markRead(userId, notificationId) {
  // Only touches unread ones, so the original "read at" time is kept.
  const res = await Notification.updateOne(
    { _id: notificationId, user: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  if (res.matchedCount === 0) {
    // Already read (fine, repeating is harmless) or doesn't exist / isn't yours (404).
    const exists = await Notification.exists({ _id: notificationId, user: userId });
    if (!exists) throw ApiError.notFound('Notification not found');
  }
}

async function markAllRead(userId) {
  await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
}

module.exports = { listNotifications, countUnread, markRead, markAllRead };