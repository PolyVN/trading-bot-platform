import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';
const EXCHANGE_STATUSES = ['connected', 'degraded', 'disconnected', 'maintenance'] as const;

const exchangeConfigSchema = new Schema(
  {
    exchange: { type: String, enum: EXCHANGES, required: true, unique: true },
    displayName: { type: String, required: true },
    isEnabled: { type: Boolean, required: true, default: true },
    status: { type: String, enum: EXCHANGE_STATUSES, required: true, default: 'disconnected' },
    capabilities: {
      type: new Schema(
        {
          orderTypes: { type: [String], required: true },
          instTypes: { type: [String], required: true },
          supportsPaper: { type: Boolean, required: true },
          supportsLeverage: { type: Boolean, required: true },
          maxLeverage: { type: Number, required: true },
          supportedCurrencies: { type: [String], required: true },
          marginModes: { type: [{ type: String, enum: ['cross', 'isolated'] }], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
    rateLimitState: {
      type: new Schema(
        {
          requestsRemaining: { type: Number },
          requestsLimit: { type: Number },
          resetAt: { type: Date },
          isThrottled: { type: Boolean, default: false },
        },
        { _id: false },
      ),
    },
    lastHealthCheck: { type: Date },
    lastError: {
      type: new Schema({ message: String, timestamp: Date }, { _id: false }),
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: false, updatedAt: 'updatedAt' },
  },
);

exchangeConfigSchema.index({ status: 1 });

export const ExchangeConfigModel = mongoose.model('ExchangeConfig', exchangeConfigSchema);
