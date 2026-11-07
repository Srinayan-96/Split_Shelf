require('dotenv').config();
const { z } = require('zod');

// Describe every env var we depend on. If one is missing or wrong,
// the app refuses to start instead of failing mysteriously later.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  CRON_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  REMINDER_CRON: z.string().default('0 8 * * *'),
  CRON_TIMEZONE: z.string().default('Asia/Kolkata'),
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.issues);
  process.exit(1);
}

module.exports = { env: parsed.data };