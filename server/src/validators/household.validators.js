const { z } = require('zod');

const createHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(50),
});

// Codes are stored uppercase, so we uppercase the input. "ab3k9xyz" works.
const joinHouseholdSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().length(8),
});

module.exports = { createHouseholdSchema, joinHouseholdSchema };