const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,        // the DB enforces this, so two simultaneous signups can't both win
      lowercase: true,     // "A@x.com" and "a@x.com" are the same person
      trim: true,
      maxlength: 254,
    },
    // select:false means queries never return the hash unless we explicitly ask.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);