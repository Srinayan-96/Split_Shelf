const { z } = require('zod');

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // The cursor looks like "<time in ms>_<purchase id>". We decode it into a date and an id.
  before: z
    .string()
    .regex(/^\d{10,15}_[a-f\d]{24}$/i, 'invalid cursor')
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const [ms, id] = value.split('_');
      return { at: new Date(Number(ms)), id };
    }),
});

module.exports = { feedQuerySchema };
