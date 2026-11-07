const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    type: { type: String, enum: ['ITEM_LOW', 'RUN_OUT_SOON', 'YOUR_TURN'], required: true },
    message: { type: String, required: true, maxlength: 200 },
    // e.g. "YOUR_TURN:soon:<itemId>:<cycle>". Same key -> same notification, once.
    dedupeKey: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The inbox query: "my unread notifications, newest first".
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

// If the cron runs twice (restart, two instances), nobody is notified twice.
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });

// Deleting an item, or clearing its alerts after a purchase, queries by item.
notificationSchema.index({ item: 1 });

// MongoDB deletes notifications after 30 days by itself, so the collection can't grow forever.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Notification', notificationSchema);