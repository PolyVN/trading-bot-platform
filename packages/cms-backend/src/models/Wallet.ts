import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const walletSchema = new Schema(
  {
    walletId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    exchange: { type: String, enum: EXCHANGES, required: true, index: true },
    credentials: { type: Schema.Types.Mixed, required: true },
    balance: { type: Schema.Types.Mixed, default: {} },
    balanceUpdatedAt: { type: Date },
    assignedBotIds: { type: [String], default: [] },
    walletMode: {
      type: String,
      enum: ['exclusive', 'shared'],
      required: true,
      default: 'exclusive',
    },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: String },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  },
);

walletSchema.index({ exchange: 1 });
walletSchema.index({ exchange: 1, 'credentials.proxyAddress': 1 }, { sparse: true });
walletSchema.index({ exchange: 1, 'credentials.apiKeyHash': 1 }, { sparse: true });

export type IWallet = InferSchemaType<typeof walletSchema>;
export const Wallet = mongoose.model('Wallet', walletSchema);
