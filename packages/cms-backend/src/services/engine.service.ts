import crypto from 'node:crypto';
import type { AuthUser } from '../middleware/auth.js';
import { mongoFilter } from '../middleware/auth.js';
import { Engine } from '../models/Engine.js';
import { redisPub } from '../lib/redis.js';
import { auditQueue } from '../workers/index.js';
import { REDIS_CHANNELS } from '../constants.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/route-utils.js';

interface EngineListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
}

export class EngineService {
  static async list(query: EngineListQuery, user: AuthUser) {
    const {
      page = 1,
      limit = 50,
      sort,
      order = 'desc',
      status,
    } = query;

    const queryFilter: Record<string, unknown> = {};

    if (status) queryFilter.status = status;

    // Engines are not exchange-scoped per se, but filter by supportedExchanges
    // if the user has exchange restrictions.
    if (user.role !== 'admin' && user.allowedExchanges.length > 0) {
      queryFilter.supportedExchanges = { $in: user.allowedExchanges };
    }

    const sortObj = buildSortObject(sort, order);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Engine.find(mongoFilter(queryFilter)).sort(sortObj).skip(skip).limit(limit).lean(),
      Engine.countDocuments(mongoFilter(queryFilter)),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  static async getById(engineId: string, user: AuthUser) {
    const engine = await Engine.findOne(mongoFilter({ engineId })).lean();
    if (!engine) throw new NotFoundError('Engine not found');

    // Check exchange access: operator can only see engines that support their exchanges
    if (user.role !== 'admin' && user.allowedExchanges.length > 0) {
      const engineExchanges = (engine.supportedExchanges ?? []) as string[];
      const hasAccess = user.allowedExchanges.some((ex) => engineExchanges.includes(ex));
      if (!hasAccess) throw new ForbiddenError('No access to this engine');
    }

    return engine;
  }

  static async drain(engineId: string, user: AuthUser) {
    const engine = await Engine.findOne(mongoFilter({ engineId }));
    if (!engine) throw new NotFoundError('Engine not found');

    if (engine.status === 'draining') {
      throw new ConflictError('Engine is already draining');
    }
    if (engine.status === 'offline') {
      throw new ConflictError('Cannot drain an offline engine');
    }

    engine.status = 'draining';
    await engine.save();

    // Publish drain command to the trading engine
    await redisPub.publish(
      REDIS_CHANNELS.cms.engineDrain(engineId),
      JSON.stringify({
        engineId,
        action: 'drain',
        timestamp: Date.now(),
      }),
    );

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'engine.drain',
      exchange: null,
      entityType: 'engine',
      entityId: engineId,
      details: { activeBotCount: engine.activeBotCount },
      timestamp: new Date(),
    });

    return engine.toJSON();
  }
}
