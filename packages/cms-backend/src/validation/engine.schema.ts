import { z } from 'zod';
import { listQuerySchema } from './common.js';

const ENGINE_STATUSES = ['online', 'draining', 'offline'] as const;

// --- Engine list query ---

export const engineListQuerySchema = listQuerySchema.extend({
  status: z.enum(ENGINE_STATUSES).optional(),
});

export type EngineListQuery = z.infer<typeof engineListQuerySchema>;
