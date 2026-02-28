import crypto from 'node:crypto';
import type { AuthUser } from '../middleware/auth.js';
import { buildExchangeFilter, checkExchangeAccess, mongoFilter } from '../middleware/auth.js';
import { Bot } from '../models/Bot.js';
import { Wallet } from '../models/Wallet.js';
import { StrategyTemplate } from '../models/StrategyTemplate.js';
import { redisPub } from '../lib/redis.js';
import { auditQueue } from '../workers/index.js';
import { REDIS_CHANNELS } from '../constants.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError, ConflictError } from '../lib/route-utils.js';

interface BotListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  exchange?: string;
  status?: string;
  mode?: string;
  strategyName?: string;
  assignedEngineId?: string;
}

export class BotService {
  static async list(query: BotListQuery, user: AuthUser) {
    const {
      page = 1,
      limit = 50,
      sort,
      order = 'desc',
      exchange,
      status,
      mode,
      strategyName,
      assignedEngineId,
    } = query;

    const exchangeFilter = buildExchangeFilter(user);
    const queryFilter: Record<string, unknown> = { ...exchangeFilter };

    // Merge query exchange filter with user's exchange filter
    if (exchange) {
      if (exchangeFilter.exchange) {
        // User has exchange restrictions — only allow if the requested exchange is in their allowed list
        const allowed = (exchangeFilter.exchange as { $in: string[] }).$in;
        if (!allowed.includes(exchange)) {
          return buildPaginatedResponse([], 0, page, limit);
        }
        queryFilter.exchange = exchange;
      } else {
        queryFilter.exchange = exchange;
      }
    }

    if (status) queryFilter.status = status;
    if (mode) queryFilter.mode = mode;
    if (strategyName) queryFilter.strategyName = strategyName;
    if (assignedEngineId) queryFilter.assignedEngineId = assignedEngineId;

    const sortObj = buildSortObject(sort, order);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Bot.find(mongoFilter(queryFilter)).sort(sortObj).skip(skip).limit(limit).lean(),
      Bot.countDocuments(mongoFilter(queryFilter)),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  static async getById(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId })).lean();
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);
    return bot;
  }

  static async create(data: Record<string, unknown>, user: AuthUser) {
    const botId = crypto.randomUUID();
    const exchange = data.exchange as string;

    checkExchangeAccess(user, exchange);

    // Validate wallet exists and exchange matches
    const wallet = await Wallet.findOne(mongoFilter({ walletId: data.walletId })).lean();
    if (!wallet) throw new NotFoundError('Wallet not found');
    if (wallet.exchange !== exchange) {
      throw new ConflictError(`Wallet exchange (${wallet.exchange}) does not match bot exchange (${exchange})`);
    }

    // Validate strategy template exists and supports the exchange
    const strategy = await StrategyTemplate.findOne(mongoFilter({ name: data.strategyName })).lean();
    if (!strategy) throw new NotFoundError('Strategy template not found');
    if (!strategy.supportedExchanges.includes(exchange)) {
      throw new ConflictError(`Strategy "${data.strategyName}" does not support exchange "${exchange}"`);
    }

    const bot = await Bot.create({
      ...data,
      botId,
      status: 'IDLE',
      createdBy: user.sub,
    });

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.create',
      exchange,
      entityType: 'bot',
      entityId: botId,
      details: { name: data.name, strategyName: data.strategyName },
      timestamp: new Date(),
    });

    return bot.toJSON();
  }

  static async update(botId: string, data: Record<string, unknown>, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    // Prevent exchange change
    if (data.exchange && data.exchange !== bot.exchange) {
      throw new ConflictError('Cannot change bot exchange after creation');
    }

    // Validate wallet if walletId is being changed
    if (data.walletId && data.walletId !== bot.walletId) {
      const wallet = await Wallet.findOne(mongoFilter({ walletId: data.walletId })).lean();
      if (!wallet) throw new NotFoundError('Wallet not found');
      if (wallet.exchange !== bot.exchange) {
        throw new ConflictError(`Wallet exchange (${wallet.exchange}) does not match bot exchange (${bot.exchange})`);
      }
    }

    // Strip protected fields that should never be updated via the API
    const PROTECTED_FIELDS = ['botId', 'status', 'exchange', 'createdBy', 'createdAt', 'updatedAt'];
    const safeData = Object.fromEntries(
      Object.entries(data).filter(([key]) => !PROTECTED_FIELDS.includes(key)),
    );
    Object.assign(bot, safeData);
    await bot.save();

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.update',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { updatedFields: Object.keys(data) },
      timestamp: new Date(),
    });

    return bot.toJSON();
  }

  static async delete(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    const deletableStatuses = ['IDLE', 'STOPPED', 'ERROR'];
    if (!deletableStatuses.includes(bot.status)) {
      throw new ConflictError(`Cannot delete bot in status ${bot.status}. Must be IDLE, STOPPED, or ERROR.`);
    }

    await Bot.deleteOne(mongoFilter({ botId }));

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.delete',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { name: bot.name },
      timestamp: new Date(),
    });
  }

  static async start(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    const startableStatuses = ['IDLE', 'STOPPED', 'ERROR', 'PAUSED', 'RISK_STOPPED'];
    if (!startableStatuses.includes(bot.status)) {
      throw new ConflictError(`Cannot start bot in status ${bot.status}`);
    }

    await redisPub.publish(
      REDIS_CHANNELS.cms.botCommand(bot.assignedEngineId),
      JSON.stringify({
        action: 'start',
        botId,
        exchange: bot.exchange,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.start',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { engineId: bot.assignedEngineId },
      timestamp: new Date(),
    });
  }

  static async stop(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    const stoppableStatuses = ['RUNNING', 'PAUSED'];
    if (!stoppableStatuses.includes(bot.status)) {
      throw new ConflictError(`Cannot stop bot in status ${bot.status}`);
    }

    await redisPub.publish(
      REDIS_CHANNELS.cms.botCommand(bot.assignedEngineId),
      JSON.stringify({
        action: 'stop',
        botId,
        exchange: bot.exchange,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.stop',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { engineId: bot.assignedEngineId },
      timestamp: new Date(),
    });
  }

  static async pause(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    if (bot.status !== 'RUNNING') {
      throw new ConflictError(`Cannot pause bot in status ${bot.status}. Must be RUNNING.`);
    }

    await redisPub.publish(
      REDIS_CHANNELS.cms.botCommand(bot.assignedEngineId),
      JSON.stringify({
        action: 'pause',
        botId,
        exchange: bot.exchange,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.pause',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { engineId: bot.assignedEngineId },
      timestamp: new Date(),
    });
  }

  static async resume(botId: string, user: AuthUser) {
    const bot = await Bot.findOne(mongoFilter({ botId }));
    if (!bot) throw new NotFoundError('Bot not found');

    checkExchangeAccess(user, bot.exchange);

    if (bot.status !== 'PAUSED') {
      throw new ConflictError(`Cannot resume bot in status ${bot.status}. Must be PAUSED.`);
    }

    await redisPub.publish(
      REDIS_CHANNELS.cms.botCommand(bot.assignedEngineId),
      JSON.stringify({
        action: 'resume',
        botId,
        exchange: bot.exchange,
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'bot.resume',
      exchange: bot.exchange,
      entityType: 'bot',
      entityId: botId,
      details: { engineId: bot.assignedEngineId },
      timestamp: new Date(),
    });
  }

}
