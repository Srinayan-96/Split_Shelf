const { z } = require('zod');

const listQuerySchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().regex(/^[a-f\d]{24}$/i, 'before must be a notification id').optional(),
});

module.exports = { listQuerySchema };