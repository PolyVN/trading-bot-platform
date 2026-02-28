import crypto from 'node:crypto';
import type { AuthUser } from '../middleware/auth.js';
import { buildExchangeFilter, checkExchangeAccess, mongoFilter } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { Bot } from '../models/Bot.js';
import { redisPub } from '../lib/redis.js';
import { auditQueue } from '../workers/index.js';
import { REDIS_CHANNELS } from '../constants.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError, ConflictError } from '../lib/route-utils.js';

interface OrderListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  exchange?: string;
  botId?: string;
  status?: string;
  instId?: string;
  side?: string;
  source?: string;
  isPaper?: boolean;
}

export class OrderService {
  static async list(query: OrderListQuery, user: AuthUser) {
    const {
      page = 1,
      limit = 50,
      sort,
      order = 'desc',
      exchange,
      botId,
      status,
      instId,
      side,
      source,
      isPaper,
    } = query;

    const exchangeFilter = buildExchangeFilter(user);
    const queryFilter: Record<string, unknown> = { ...exchangeFilter };

    if (exchange) {
      if (exchangeFilter.exchange) {
        const allowed = (exchangeFilter.exchange as { $in: string[] }).$in;
        if (!allowed.includes(exchange)) {
          return buildPaginatedResponse([], 0, page, limit);
        }
        queryFilter.exchange = exchange;
      } else {
        queryFilter.exchange = exchange;
      }
    }

    if (botId) queryFilter.botId = botId;
    if (status) queryFilter.status = status;
    if (instId) queryFilter.instId = instId;
    if (side) queryFilter.side = side;
    if (source) queryFilter.source = source;
    if (isPaper !== undefined) queryFilter.isPaper = isPaper;

    const sortObj = buildSortObject(sort, order);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Order.find(mongoFilter(queryFilter)).sort(sortObj).skip(skip).limit(limit).lean(),
      Order.countDocuments(mongoFilter(queryFilter)),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  static async getById(orderId: string, user: AuthUser) {
    const order = await Order.findOne(mongoFilter({ orderId })).lean();
    if (!order) throw new NotFoundError('Order not found');

    checkExchangeAccess(user, order.exchange);
    return order;
  }

  static async placeManual(data: Record<string, unknown>, user: AuthUser) {
    const exchange = data.exchange as string;
    const botId = data.botId as string;

    // Validate bot exists and is RUNNING
    const bot = await Bot.findOne(mongoFilter({ botId })).lean();
    if (!bot) throw new NotFoundError('Bot not found');
    if (bot.status !== 'RUNNING') {
      throw new ConflictError(`Cannot place order: bot is in status ${bot.status}. Must be RUNNING.`);
    }

    // Validate exchange matches
    if (bot.exchange !== exchange) {
      throw new ConflictError(`Bot exchange (${bot.exchange}) does not match order exchange (${exchange})`);
    }

    checkExchangeAccess(user, exchange);

    const orderId = crypto.randomUUID();
    const orderDoc = {
      ...data,
      orderId,
      status: 'PENDING',
      source: 'manual',
      filledSize: 0,
      remainingSize: data.size,
      fees: 0,
      isPaper: bot.mode === 'paper',
      timeline: [{ status: 'PENDING', timestamp: new Date(), details: 'Manual order placed via CMS' }],
    };
    const order = await Order.create(orderDoc as Record<string, unknown>);

    // Publish to trading engine
    await redisPub.publish(
      REDIS_CHANNELS.cms.orderPlace(bot.assignedEngineId),
      JSON.stringify({
        orderId,
        botId,
        exchange,
        instId: data.instId,
        side: data.side,
        type: data.type,
        price: data.price,
        size: data.size,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'order.place',
      exchange,
      entityType: 'order',
      entityId: orderId,
      details: { botId, instId: data.instId, side: data.side, type: data.type, size: data.size },
      timestamp: new Date(),
    });

    return order.toJSON();
  }

  static async cancel(orderId: string, user: AuthUser) {
    const order = await Order.findOne(mongoFilter({ orderId }));
    if (!order) throw new NotFoundError('Order not found');

    checkExchangeAccess(user, order.exchange);

    const cancellableStatuses = ['PENDING', 'OPEN', 'PARTIALLY_FILLED'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new ConflictError(`Cannot cancel order in status ${order.status}`);
    }

    // Look up the bot to get the engine ID
    const bot = await Bot.findOne(mongoFilter({ botId: order.botId })).lean();
    if (!bot) throw new NotFoundError('Bot not found for this order');

    // Publish cancel command to trading engine
    await redisPub.publish(
      REDIS_CHANNELS.cms.orderCancel(bot.assignedEngineId),
      JSON.stringify({
        orderId,
        botId: order.botId,
        exchange: order.exchange,
        instId: order.instId,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'order.cancel',
      exchange: order.exchange,
      entityType: 'order',
      entityId: orderId,
      details: { botId: order.botId, instId: order.instId },
      timestamp: new Date(),
    });
  }

}
