import { z } from 'zod';
import { ORDER_SIDES, ORDER_SOURCES } from '../constants.js';
import { listQuerySchema, exchangeSchema, botIdSchema, positiveDecimalSchema } from './common.js';

// --- Manual order ---

const MANUAL_ORDER_TYPES = ['LIMIT', 'MARKET'] as const;

export const manualOrderSchema = z
  .object({
    botId: botIdSchema,
    exchange: exchangeSchema,
    instId: z.string().min(1),
    side: z.enum(ORDER_SIDES),
    type: z.enum(MANUAL_ORDER_TYPES),
    price: positiveDecimalSchema.optional(),
    size: positiveDecimalSchema,
    currency: z.string().min(1),
    // Polymarket-specific
    tokenId: z.string().optional(),
    outcome: z.enum(['YES', 'NO']).optional(),
    // OKX-specific
    leverage: z.number().int().min(1).max(125).optional(),
    marginMode: z.enum(['cross', 'isolated']).optional(),
    stopPrice: positiveDecimalSchema.optional(),
    tpPrice: positiveDecimalSchema.optional(),
    slPrice: positiveDecimalSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // LIMIT orders require price
    if (data.type === 'LIMIT' && data.price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'price is required for LIMIT orders',
        path: ['price'],
      });
    }

    if (data.exchange === 'polymarket') {
      if (data.outcome == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'outcome is required for Polymarket orders',
          path: ['outcome'],
        });
      }
      if (data.leverage != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'leverage is not allowed for Polymarket orders',
          path: ['leverage'],
        });
      }
      if (data.marginMode != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'marginMode is not allowed for Polymarket orders',
          path: ['marginMode'],
        });
      }
    }
  });

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

// --- Cancel order ---

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// --- Order list query ---

export const orderListQuerySchema = listQuerySchema.extend({
  botId: z.string().optional(),
  status: z.string().optional(),
  instId: z.string().optional(),
  side: z.enum(ORDER_SIDES).optional(),
  source: z.enum(ORDER_SOURCES).optional(),
  isPaper: z.coerce.boolean().optional(),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
