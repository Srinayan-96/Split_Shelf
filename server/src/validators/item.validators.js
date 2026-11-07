const { z } = require('zod');

const DAY_MS = 24 * 60 * 60 * 1000;

const createItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  unit: z.string().trim().max(20).optional(),
});

const boughtSchema = z.object({
  // The client makes a fresh random id each time the user taps "I bought this",
  // and re-sends the SAME id if it retries that tap.
  idempotencyKey: z.string().trim().min(8).max(100),

  // Optional: "I bought it yesterday". Not in the future, not older than a year.
  boughtAt: z.coerce
    .date()
    .optional()
    .refine(
      (d) => !d || (d.getTime() <= Date.now() + 60_000 && d.getTime() >= Date.now() - 365 * DAY_MS),
      'boughtAt must be within the last year and not in the future'
    ),

  quantity: z.number().positive().max(100000).optional(),
  // Whole paise only. The server refuses decimals such as 49.5.
  pricePaise: z.number().int().min(0).max(100_000_000).optional(),
  note: z.string().trim().max(200).optional(),
});

module.exports = { createItemSchema, boughtSchema };
