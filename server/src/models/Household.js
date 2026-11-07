const mongoose = require('mongoose');

const MAX_MEMBERS = 10;

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const householdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    members: {
      type: [memberSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= MAX_MEMBERS,
        message: `A household needs 1 to ${MAX_MEMBERS} members`,
      },
    },
  },
  { timestamps: true }
);

// A user can belong to only ONE household. On an array field this index is
// "multikey", and uniqueness applies across documents: two different
// households can never contain the same user. The database enforces the rule,
// so two simultaneous joins can't break it. Delete a household when its last
// member leaves, so no empty members arrays are left behind.
householdSchema.index({ 'members.user': 1 }, { unique: true });

module.exports = mongoose.model('Household', householdSchema);
module.exports.MAX_MEMBERS = MAX_MEMBERS;