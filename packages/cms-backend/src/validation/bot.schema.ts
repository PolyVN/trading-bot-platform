import { z } from 'zod';
import { MODES } from '../constants.js';
import { listQuerySchema, exchangeSchema, positiveDecimalSchema } from './common.js';

// --- Risk limits ---

const riskLimitsSchema = z.object({
  maxPositionSize: positiveDecimalSchema,
  maxOrdersPerMinute: z.number().int().positive(),
  maxDailyLoss: positiveDecimalSchema,
  maxDrawdown: z.number().positive().max(100),
  // Optional universal
  maxUnrealizedLoss: positiveDecimalSchema.optional(),
  maxExposure: positiveDecimalSchema.optional(),
  stopLossPerMarket: positiveDecimalSchema.optional(),
  // OKX-specific (validated via superRefine on parent)
  maxLeverage: z.number().int().min(1).max(125).optional(),
  maxPositionNotional: positiveDecimalSchema.optional(),
  liquidationBuffer: z.number().min(0).max(100).optional(),
  maxFundingRateExposure: positiveDecimalSchema.optional(),
});

const OKX_ONLY_RISK_FIELDS = [
  'maxLeverage',
  'maxPositionNotional',
  'liquidationBuffer',
  'maxFundingRateExposure',
] as const;

// --- Create bot (base object, before refinement) ---

const createBotBaseSchema = z.object({
  name: z.string().min(1).max(100),
  exchange: exchangeSchema,
  strategyName: z.string().min(1),
  strategyConfig: z.record(z.string(), z.unknown()).default({}),
  walletId: z.string().min(1),
  mode: z.enum(MODES),
  exchangeConfig: z.record(z.string(), z.unknown()).default({}),
  riskLimits: riskLimitsSchema,
  instIds: z.array(z.string().min(1)).default([]),
  tickInterval: z.number().int().positive().default(1000),
  tags: z.array(z.string().min(1)).default([]),
  assignedEngineId: z.string().min(1),
});

export const createBotSchema = createBotBaseSchema.superRefine((data, ctx) => {
  if (data.exchange === 'polymarket') {
    for (const field of OKX_ONLY_RISK_FIELDS) {
      if (data.riskLimits[field] != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `riskLimits.${field} is only valid for OKX bots`,
          path: ['riskLimits', field],
        });
      }
    }
  }
});

export type CreateBotInput = z.infer<typeof createBotSchema>;

// --- Update bot (partial, exchange immutable) ---

export const updateBotSchema = createBotBaseSchema
  .omit({ exchange: true })
  .partial()
  .superRefine((data, ctx) => {
    // When riskLimits is provided in an update, all required fields must be present.
    // Exchange-specific OKX validation happens at the service layer (exchange is not in payload).
    if (data.riskLimits) {
      const required = ['maxPositionSize', 'maxOrdersPerMinute', 'maxDailyLoss', 'maxDrawdown'] as const;
      for (const field of required) {
        if (data.riskLimits[field] == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `riskLimits.${field} is required when riskLimits is provided`,
            path: ['riskLimits', field],
          });
        }
      }
    }
  });

export type UpdateBotInput = z.infer<typeof updateBotSchema>;

// --- Bot list query ---

export const botListQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  mode: z.enum(MODES).optional(),
  strategyName: z.string().optional(),
  assignedEngineId: z.string().optional(),
});

export type BotListQuery = z.infer<typeof botListQuerySchema>;
