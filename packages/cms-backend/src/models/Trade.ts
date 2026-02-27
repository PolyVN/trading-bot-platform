import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const DECIMAL_FIELDS = ['price', 'size', 'fee', 'realizedPnl', 'realizedPnlUsd'];

const tradeSchema = new Schema(
  {
    tradeId: { type: String, required: true, unique: true },
    exchangeTradeId: { type: String },
    exchange: { type: String, enum: EXCHANGES, required: true, index: true },
    botId: { type: String, required: true },
    orderId: { type: String, required: true },
    instId: { type: String, required: true },
    marketTitle: { type: String },
    tokenId: { type: String },
    outcome: { type: String, enum: ['YES', 'NO'] },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    price: { type: Schema.Types.Decimal128, required: true },
    size: { type: Schema.Types.Decimal128, required: true },
    fee: { type: Schema.Types.Decimal128, default: 0 },
    currency: { type: String, required: true },
    realizedPnl: { type: Schema.Types.Decimal128, default: 0 },
    realizedPnlUsd: { type: Schema.Types.Decimal128, default: 0 },
    isPaper: { type: Boolean, required: true, default: false },
    strategyName: { type: String },
    timestamp: { type: Date, required: true },
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

tradeSchema.index({ exchange: 1, botId: 1, timestamp: -1 });
tradeSchema.index({ exchange: 1, instId: 1, timestamp: -1 });
tradeSchema.index({ strategyName: 1 });
tradeSchema.index({ isPaper: 1 });

export const Trade = mongoose.model('Trade', tradeSchema);
