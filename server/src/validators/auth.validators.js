const { z } = require('zod');

// bcrypt silently ignores everything after 72 BYTES. Without this check, two
// different long passwords could be treated as the same one. We check bytes,
// not characters, because emoji and Hindi characters take several bytes each.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long (max 72 bytes)');

const email = z.string().trim().toLowerCase().email().max(254);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email,
  password,
});

// For login we don't enforce password rules. We only check the password matches.
const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

module.exports = { registerSchema, loginSchema };