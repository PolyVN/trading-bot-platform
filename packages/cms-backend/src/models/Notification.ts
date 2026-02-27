import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';
const NOTIFICATION_TYPES = [
  'risk_stop',
  'bot_error',
  'market_resolved',
  'large_loss',
  'target_hit',
  'system',
  'exchange_disconnect',
  'rate_limit',
] as const;
const SEVERITIES = ['info', 'warning', 'critical'] as const;

const notificationSchema = new Schema({
  notificationId: { type: String, required: true, unique: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  severity: { type: String, enum: SEVERITIES, required: true },
  exchange: { type: String, enum: [...EXCHANGES, null] },
  title: { type: String, required: true },
  message: { type: String, required: true },
  botId: { type: String },
  isRead: { type: Boolean, required: true, default: false },
  sentViaTelegram: { type: Boolean, default: false },
  createdAt: { type: Date, required: true, default: Date.now },
});

notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ botId: 1 });
notificationSchema.index({ exchange: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
