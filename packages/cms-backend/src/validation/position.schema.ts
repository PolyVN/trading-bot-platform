import { z } from 'zod';
import { listQuerySchema } from './common.js';

// --- Position list query ---

export const positionListQuerySchema = listQuerySchema.extend({
  botId: z.string().optional(),
  instId: z.string().optional(),
  isPaper: z.coerce.boolean().optional(),
});

export type PositionListQuery = z.infer<typeof positionListQuerySchema>;
