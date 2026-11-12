const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    // Lowercased copy of the name, used for the uniqueness check below.
    nameKey: { type: String, required: true },
    unit: { type: String, trim: true, maxlength: 20, default: 'pcs' },

    status: { type: String, enum: ['ok', 'low'], default: 'ok' },
    lowMarkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lowMarkedAt: { type: Date, default: null },

    lastBoughtBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastBoughtAt: { type: Date, default: null },
    lastQuantity: { type: Number, default: null },
    nextTurn: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Prediction results are CACHED here, recalculated each time a purchase is logged.
    // The daily cron then needs only one cheap indexed query, not a log scan per item.
    avgIntervalDays: { type: Number, default: null },
    predictedRunOutAt: { type: Date, default: null },

    // Refreshed every time a purchase is recorded, so the list needs no extra queries.
    purchaseCount: { type: Number, default: 0 },
    forecastGaps: { type: Number, default: 0 }, // purchases a day or more apart, used for the "x so far" message
  },
  { timestamps: true }
);

// "Toilet Paper" and "toilet paper " are the same item in the same household.
itemSchema.pre('validate', function () {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();

});

// Race-proof duplicate protection: two roommates adding "Dish soap" at the
// same instant -> one succeeds, one gets a 409.
itemSchema.index({ household: 1, nameKey: 1 }, { unique: true });

// Dashboard query: items of a household filtered by status.
itemSchema.index({ household: 1, status: 1 });

// Cron query: "which items are predicted to run out soon?" Partial index
// skips items that have no prediction yet, which keeps it small.
itemSchema.index(
  { predictedRunOutAt: 1 },
  { partialFilterExpression: { predictedRunOutAt: { $type: 'date' } } }
);

module.exports = mongoose.model('Item', itemSchema);