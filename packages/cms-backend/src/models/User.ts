import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';
const ROLES = ['admin', 'operator', 'viewer'] as const;

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: 'viewer' },
    allowedExchanges: { type: [{ type: String, enum: EXCHANGES }], default: [] },
    telegramChatId: { type: String },
    isActive: { type: Boolean, required: true, default: true },
    lastLogin: { type: Date },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export const User = mongoose.model('User', userSchema);
