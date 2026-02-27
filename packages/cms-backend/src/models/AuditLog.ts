import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const auditLogSchema = new Schema({
  auditId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  action: { type: String, required: true },
  exchange: { type: String, enum: [...EXCHANGES, null] },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  ip: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ exchange: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
