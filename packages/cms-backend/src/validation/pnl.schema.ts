import { z } from 'zod';
import { exchangeFilterSchema } from './common.js';

const ENTITY_TYPES = ['bot', 'strategy', 'wallet', 'exchange', 'total'] as const;
const PERIODS = ['1h', '4h', '1d', '1w'] as const;

// --- PnL query ---

export const pnlQuerySchema = exchangeFilterSchema.extend({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().optional(),
  period: z.enum(PERIODS),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isPaper: z.coerce.boolean().optional(),
});

export type PnlQuery = z.infer<typeof pnlQuerySchema>;
