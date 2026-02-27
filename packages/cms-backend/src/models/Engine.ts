import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';
const ENGINE_STATUSES = ['online', 'draining', 'offline'] as const;

const engineSchema = new Schema(
  {
    engineId: { type: String, required: true, unique: true },
    supportedExchanges: { type: [{ type: String, enum: EXCHANGES }], required: true },
    status: { type: String, enum: ENGINE_STATUSES, required: true, default: 'offline' },
    version: { type: String, required: true },
    activeBotCount: { type: Number, default: 0 },
    activeBotIds: { type: [String], default: [] },
    host: { type: String },
    port: { type: Number },
    startedAt: { type: Date, required: true },
    lastHeartbeat: { type: Date },
    metrics: {
      type: new Schema(
        {
          cpuPercent: { type: Number },
          memoryMb: { type: Number },
          uptimeSeconds: { type: Number },
        },
        { _id: false },
      ),
    },
  },
  {
    timestamps: true,
  },
);

engineSchema.index({ status: 1 });
engineSchema.index({ supportedExchanges: 1 });

export const Engine = mongoose.model('Engine', engineSchema);
