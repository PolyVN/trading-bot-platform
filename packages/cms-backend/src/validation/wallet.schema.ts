import { z } from 'zod';
import { listQuerySchema, exchangeSchema } from './common.js';

// --- Create wallet ---

const WALLET_MODES = ['exclusive', 'shared'] as const;

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  exchange: exchangeSchema,
  credentials: z.record(z.string(), z.unknown()),
  walletMode: z.enum(WALLET_MODES).default('exclusive'),
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;

// --- Wallet list query ---

export const walletListQuerySchema = listQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
});

export type WalletListQuery = z.infer<typeof walletListQuerySchema>;
