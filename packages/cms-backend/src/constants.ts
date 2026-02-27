/**
 * Re-export shared-types constants as the single source of truth.
 * Mongoose/Zod need array forms, so we derive them from the canonical constants.
 */
export {
  REDIS_CHANNELS,
  QUEUE_NAMES,
  VALID_TRANSITIONS,
  isValidTransition,
  BOT_STATES,
} from '../../shared-types/generated/ts/runtime-constants.js';

export type {
  Exchange,
  BotStatus,
  OrderSide,
  OrderType,
  OrderSource,
  FillRole,
} from '../../shared-types/generated/ts/index.js';

export type { BotStatusValue } from '../../shared-types/generated/ts/runtime-constants.js';

// Array forms for Mongoose `enum` and Zod `z.enum()` validation.
// Derived from shared-types canonical objects where possible to stay in sync.
export const EXCHANGES = ['polymarket', 'okx'] as const;
export const BOT_STATUSES = Object.values(BOT_STATES) as [string, ...string[]];
export const ORDER_STATUSES = Object.keys(VALID_TRANSITIONS) as [string, ...string[]];
export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export const ORDER_TYPES = ['LIMIT', 'MARKET', 'STOP', 'TRAILING', 'TP_SL', 'ICEBERG', 'TWAP'] as const;
export const ORDER_SOURCES = ['strategy', 'manual', 'risk_stop'] as const;
export const FILL_ROLES = ['maker', 'taker'] as const;
export const MODES = ['live', 'paper'] as const;
