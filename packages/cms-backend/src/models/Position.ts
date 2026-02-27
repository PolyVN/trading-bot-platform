import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const DECIMAL_FIELDS = [
  'size',
  'entryPrice',
  'currentPrice',
  'unrealizedPnl',
  'unrealizedPnlUsd',
  'realizedPnl',
  'realizedPnlUsd',
  'liquidationPrice',
  'margin',
];

const positionSchema = new Schema(
  {
    positionId: { type: String, required: true, unique: true },
    exchange: { type: String, enum: EXCHANGES, required: true, index: true },
    botId: { type: String, required: true },
    instId: { type: String, required: true },
    marketTitle: { type: String },
    side: { type: String, enum: ['BUY', 'SELL', 'LONG', 'SHORT', 'NET'], required: true },
    size: { type: Schema.Types.Decimal128, required: true },
    entryPrice: { type: Schema.Types.Decimal128, required: true },
    currentPrice: { type: Schema.Types.Decimal128, required: true },
    unrealizedPnl: { type: Schema.Types.Decimal128, default: 0 },
    unrealizedPnlUsd: { type: Schema.Types.Decimal128, default: 0 },
    realizedPnl: { type: Schema.Types.Decimal128 },
    realizedPnlUsd: { type: Schema.Types.Decimal128 },
    currency: { type: String, required: true },
    isPaper: { type: Boolean, required: true, default: false },
    // Polymarket
    tokenId: { type: String },
    outcome: { type: String, enum: ['YES', 'NO'] },
    // OKX
    leverage: { type: Number },
    marginMode: { type: String, enum: ['cross', 'isolated'] },
    liquidationPrice: { type: Schema.Types.Decimal128 },
    margin: { type: Schema.Types.Decimal128 },
    marginRatio: { type: Number },
  },
  {
    timestamps: true,
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

positionSchema.index({ exchange: 1, botId: 1 });
positionSchema.index({ exchange: 1, instId: 1 });

export const Position = mongoose.model('Position', positionSchema);
