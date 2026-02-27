import mongoose, { Schema } from 'mongoose';
import { EXCHANGES } from '../constants.js';

const strategyTemplateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    description: { type: String },
    version: { type: String },
    supportedExchanges: { type: [{ type: String, enum: EXCHANGES }], required: true },
    multiMarket: { type: Boolean, required: true, default: false },
    configSchema: { type: Schema.Types.Mixed, required: true },
    defaultConfig: { type: Schema.Types.Mixed, required: true },
    requiredFeeds: { type: [String], default: [] },
    exchangeSpecificConfig: {
      type: new Schema(
        {
          polymarket: { type: Schema.Types.Mixed },
          okx: { type: Schema.Types.Mixed },
        },
        { _id: false },
      ),
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  },
);

strategyTemplateSchema.index({ supportedExchanges: 1 });
strategyTemplateSchema.index({ isActive: 1 });

export const StrategyTemplate = mongoose.model('StrategyTemplate', strategyTemplateSchema);
