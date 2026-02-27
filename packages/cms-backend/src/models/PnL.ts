import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const PNL_EXCHANGES = [...EXCHANGES, 'all'] as const;
const ENTITY_TYPES = ['bot', 'strategy', 'wallet', 'exchange', 'total'] as const;
const PERIODS = ['1h', '4h', '1d', '1w'] as const;

const DECIMAL_FIELDS = [
  'realizedPnl',
  'realizedPnlUsd',
  'unrealizedPnl',
  'unrealizedPnlUsd',
  'totalPnl',
  'totalPnlUsd',
  'totalVolume',
  'totalVolumeUsd',
  'avgWin',
  'avgLoss',
  'fees',
  'feesUsd',
];

const pnlSchema = new Schema(
  {
    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId: { type: String, required: true },
    exchange: { type: String, enum: PNL_EXCHANGES, required: true, index: true },
    period: { type: String, enum: PERIODS, required: true },
    timestamp: { type: Date, required: true },
    currency: { type: String, required: true },
    realizedPnl: { type: Schema.Types.Decimal128, default: 0 },
    realizedPnlUsd: { type: Schema.Types.Decimal128, default: 0 },
    unrealizedPnl: { type: Schema.Types.Decimal128, default: 0 },
    unrealizedPnlUsd: { type: Schema.Types.Decimal128, default: 0 },
    totalPnl: { type: Schema.Types.Decimal128, default: 0 },
    totalPnlUsd: { type: Schema.Types.Decimal128, default: 0 },
    totalVolume: { type: Schema.Types.Decimal128 },
    totalVolumeUsd: { type: Schema.Types.Decimal128 },
    tradeCount: { type: Number, default: 0 },
    winCount: { type: Number, default: 0 },
    lossCount: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    avgWin: { type: Schema.Types.Decimal128 },
    avgLoss: { type: Schema.Types.Decimal128 },
    maxDrawdown: { type: Number },
    sharpeRatio: { type: Number },
    fees: { type: Schema.Types.Decimal128, default: 0 },
    feesUsd: { type: Schema.Types.Decimal128, default: 0 },
    isPaper: { type: Boolean, required: true, default: false },
    exchangeRates: { type: Schema.Types.Mixed },
  },
  {
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        for (const key of DECIMAL_FIELDS) {
          if (ret[key] != null) {
            ret[key] = parseFloat(String(ret[key]));
          }
        }
        return ret;
      },
    },
  },
);

pnlSchema.index({ exchange: 1, entityType: 1, entityId: 1, period: 1, timestamp: -1 });
pnlSchema.index({ entityType: 1, entityId: 1, period: 1, timestamp: -1 });

export const PnL = mongoose.model('PnL', pnlSchema);
