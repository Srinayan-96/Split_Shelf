const mongoose = require('mongoose');

const restockLogSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    boughtBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    boughtAt: { type: Date, default: Date.now },

    // Days since the previous purchase of this item (null for the first one).
    intervalDays: { type: Number, default: null, min: 0 },

    // How much was bought, in the item's unit (2 rolls, 0.5 kg).
    quantity: { type: Number, default: 1, min: 0.001, max: 100000 },

    // Money in PAISE as a whole number: Rs 49.50 is stored as 4950. Never a
    // decimal, because 0.1 + 0.2 !== 0.3 in floating point. null = not entered.
    pricePaise: {
      type: Number,
      default: null,
      min: 0,
      max: 100_000_000,
      validate: {
        validator: (v) => v == null || Number.isInteger(v),
        message: 'pricePaise must be a whole number',
      },
    },

    note: { type: String, trim: true, maxlength: 200 },

    // Sent by the client with each "I bought this". If the same key arrives
    // twice (double-tap, network retry), the second insert is rejected.
    idempotencyKey: { type: String, maxlength: 100 },
  },
  // Append-only: logs are never edited, so we only need createdAt.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prediction reads the latest N purchases of one item.
restockLogSchema.index({ item: 1, boughtAt: -1 });

// Duplicate-submit guard. Partial, so requests without a key aren't affected.
restockLogSchema.index(
  { item: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

// History feed: a household's newest purchases. _id breaks ties so paging is exact.
restockLogSchema.index({ household: 1, boughtAt: -1, _id: -1 });

// One person's purchases within a household.
restockLogSchema.index({ household: 1, boughtBy: 1, boughtAt: -1 });

module.exports = mongoose.model('RestockLog', restockLogSchema);
