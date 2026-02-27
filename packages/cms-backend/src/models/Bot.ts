import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';
const BOT_STATUSES = [
  'IDLE',
  'STARTING',
  'RUNNING',
  'PAUSING',
  'PAUSED',
  'STOPPING',
  'STOPPED',
  'RISK_STOPPED',
  'ERROR',
] as const;
const MODES = ['live', 'paper'] as const;

const RISK_DECIMAL_FIELDS = [
  'maxPositionSize',
  'maxDailyLoss',
  'maxUnrealizedLoss',
  'maxExposure',
  'stopLossPerMarket',
  'maxPositionNotional',
  'maxFundingRateExposure',
];

const riskLimitsSchema = new Schema(
  {
    maxPositionSize: { type: Schema.Types.Decimal128, required: true },
    maxOrdersPerMinute: { type: Number, required: true },
    maxDailyLoss: { type: Schema.Types.Decimal128, required: true },
    maxDrawdown: { type: Number, required: true },
    maxUnrealizedLoss: { type: Schema.Types.Decimal128 },
    maxExposure: { type: Schema.Types.Decimal128 },
    stopLossPerMarket: { type: Schema.Types.Decimal128 },
    // OKX-specific
    maxLeverage: { type: Number },
    maxPositionNotional: { type: Schema.Types.Decimal128 },
    liquidationBuffer: { type: Number },
    maxFundingRateExposure: { type: Schema.Types.Decimal128 },
  },
  {
    _id: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        for (const key of RISK_DECIMAL_FIELDS) {
          if (ret[key] != null) {
            ret[key] = parseFloat(String(ret[key]));
          }
        }
        return ret;
      },
    },
  },
);

const botSchema = new Schema(
  {
    botId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    exchange: { type: String, enum: EXCHANGES, required: true, index: true },
    status: { type: String, enum: BOT_STATUSES, required: true, default: 'IDLE' },
    mode: { type: String, enum: MODES, required: true, default: 'paper' },
    strategyName: { type: String, required: true },
    strategyConfig: { type: Schema.Types.Mixed, default: {} },
    exchangeConfig: { type: Schema.Types.Mixed, default: {} },
    walletId: { type: String, required: true },
    assignedEngineId: { type: String, required: true },
    instIds: { type: [String], default: [] },
    tickInterval: { type: Number, default: 1000 },
    riskLimits: { type: riskLimitsSchema, required: true },
    tags: { type: [String], default: [] },
    lastHeartbeat: { type: Date },
    lastError: {
      type: new Schema({ message: String, timestamp: Date }, { _id: false }),
    },
    riskStopReason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

botSchema.index({ exchange: 1, status: 1 });
botSchema.index({ exchange: 1, botId: 1, status: 1 });
botSchema.index({ walletId: 1 });
botSchema.index({ strategyName: 1 });
botSchema.index({ mode: 1 });
botSchema.index({ assignedEngineId: 1 });

export const Bot = mongoose.model('Bot', botSchema);
