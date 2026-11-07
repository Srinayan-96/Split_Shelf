const crypto = require('crypto');

// No I, L, O, 0 or 1, because people read these aloud or copy them from WhatsApp
// and confuse look-alikes. 31 characters ^ 8 positions = ~850 billion codes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    // crypto.randomInt is unpredictable. Math.random() is not, and invite
    // codes are effectively passwords to a household.
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

module.exports = { generateInviteCode };