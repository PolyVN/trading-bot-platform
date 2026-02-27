import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { EXCHANGES, ORDER_SIDES, ORDER_TYPES, ORDER_STATUSES, ORDER_SOURCES, FILL_ROLES } from '../constants.js';

const DECIMAL_FIELDS = [
  'price',
  'size',
  'filledSize',
  'filledAvgPrice',
  'remainingSize',
  'fees',
  'stopPrice',
  'tpPrice',
  'slPrice',
];

const orderTimelineSchema = new Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, required: true },
    details: { type: String },
  },
  { _id: false },
);

const FILL_DECIMAL_FIELDS = ['price', 'size', 'fee', 'rebate'];

const orderFillSchema = new Schema(
  {
    fillId: { type: String, required: true },
    exchangeFillId: { type: String, required: true },
    price: { type: Schema.Types.Decimal128, required: true },
    size: { type: Schema.Types.Decimal128, required: true },
    fee: { type: Schema.Types.Decimal128, default: 0 },
    feeCurrency: { type: String, required: true },
    role: { type: String, enum: FILL_ROLES, required: true },
    rebate: { type: Schema.Types.Decimal128 },
    timestamp: { type: Date, required: true },
  },
  {
    _id: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        for (const key of FILL_DECIMAL_FIELDS) {
          if (ret[key] != null) {
            ret[key] = parseFloat(String(ret[key]));
          }
        }
        return ret;
      },
    },
  },
);

const orderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true },
    exchangeOrderId: { type: String },
    exchange: { type: String, enum: EXCHANGES, required: true, index: true },
    botId: { type: String, required: true },
    instId: { type: String, required: true },
    marketTitle: { type: String },
    tokenId: { type: String },
    outcome: { type: String, enum: ['YES', 'NO'] },
    side: { type: String, enum: ORDER_SIDES, required: true },
    type: { type: String, enum: ORDER_TYPES, required: true },
    price: { type: Schema.Types.Decimal128, required: true },
    size: { type: Schema.Types.Decimal128, required: true },
    filledSize: { type: Schema.Types.Decimal128, default: 0 },
    filledAvgPrice: { type: Schema.Types.Decimal128 },
    remainingSize: { type: Schema.Types.Decimal128, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'PENDING' },
    source: { type: String, enum: ORDER_SOURCES, required: true },
    isPaper: { type: Boolean, required: true, default: false },
    strategyName: { type: String },
    signalReason: { type: String },
    currency: { type: String, required: true },
    fees: { type: Schema.Types.Decimal128, default: 0 },
    error: { type: String },
    timeline: { type: [orderTimelineSchema], default: [] },
    fills: { type: [orderFillSchema], default: [] },
    // OKX-specific
    leverage: { type: Number },
    marginMode: { type: String, enum: ['cross', 'isolated'] },
    stopPrice: { type: Schema.Types.Decimal128 },
    tpPrice: { type: Schema.Types.Decimal128 },
    slPrice: { type: Schema.Types.Decimal128 },
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

orderSchema.index({ exchange: 1, botId: 1, createdAt: -1 });
orderSchema.index({ exchange: 1, instId: 1, createdAt: -1 });
orderSchema.index({ exchange: 1, status: 1 });
orderSchema.index({ exchangeOrderId: 1 }, { sparse: true });
orderSchema.index({ isPaper: 1 });

export type IOrder = InferSchemaType<typeof orderSchema>;
export const Order = mongoose.model('Order', orderSchema);
