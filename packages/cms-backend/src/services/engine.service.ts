import crypto from 'node:crypto';
import type { AuthUser } from '../middleware/auth.js';
import { mongoFilter } from '../middleware/auth.js';
import { Engine } from '../models/Engine.js';
import { redisPub } from '../lib/redis.js';
import { auditQueue } from '../workers/index.js';
import { REDIS_CHANNELS } from '../constants.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/route-utils.js';
import { logger } from '../lib/logger.js';

/** Engines with no heartbeat for this many ms are marked offline. */
const HEARTBEAT_TIMEOUT_MS = 30_000;

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

  /**
   * Handle te:engine:register — upsert engine doc, set status='online'.
   * Called from redis-subscriber when a TE instance starts up.
   */
  static async handleRegister(data: Record<string, unknown>): Promise<void> {
    const { engineId, supportedExchanges, version, host, port } = data;
    if (!engineId || !supportedExchanges || !version) {
      logger.warn({ data }, '[EngineService] Invalid register payload, missing required fields');
      return;
    }

    const now = new Date();
    await Engine.findOneAndUpdate(
      mongoFilter({ engineId }),
      {
        $set: {
          engineId,
          supportedExchanges,
          version,
          host: host ?? null,
          port: port ?? null,
          status: 'online',
          startedAt: now,
          lastHeartbeat: now,
        },
      },
      { upsert: true },
    );

    logger.info({ engineId, supportedExchanges, version }, '[EngineService] Engine registered');
  }

  /**
   * Handle te:engine:heartbeat — update lastHeartbeat + optional metrics.
   * Ensures engine status is 'online' (recovers from stale timeout).
   */
  static async handleHeartbeat(data: Record<string, unknown>): Promise<void> {
    const { engineId } = data;
    if (!engineId) return;

    const update: Record<string, unknown> = {
      lastHeartbeat: new Date(),
    };

    // If heartbeat carries metrics or bot info, merge them
    if (data.activeBotCount !== undefined) update.activeBotCount = data.activeBotCount;
    if (data.activeBotIds !== undefined) update.activeBotIds = data.activeBotIds;
    if (data.metrics) update.metrics = data.metrics;

    // Re-mark online if previously timed out (but not if draining)
    const result = await Engine.findOneAndUpdate(
      mongoFilter({ engineId, status: { $ne: 'draining' } }),
      { $set: { ...update, status: 'online' } },
    );

    // If engine is draining, still update heartbeat but don't change status
    if (!result) {
      await Engine.findOneAndUpdate(
        mongoFilter({ engineId }),
        { $set: update },
      );
    }
  }

  /**
   * Handle te:engine:shutdown — mark engine offline.
   */
  static async handleShutdown(data: Record<string, unknown>): Promise<void> {
    const { engineId } = data;
    if (!engineId) return;

    await Engine.findOneAndUpdate(
      mongoFilter({ engineId }),
      {
        $set: {
          status: 'offline',
          activeBotCount: 0,
          activeBotIds: [],
          lastHeartbeat: new Date(),
        },
      },
    );

    logger.info({ engineId }, '[EngineService] Engine shut down');
  }

  /**
   * Mark engines with stale heartbeats as offline.
   * Called periodically (e.g., every 10s) from a background interval.
   */
  static async checkStaleEngines(): Promise<number> {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

    const result = await Engine.updateMany(
      mongoFilter({
        status: { $in: ['online', 'draining'] },
        lastHeartbeat: { $lt: cutoff },
      }),
      {
        $set: {
          status: 'offline',
          activeBotCount: 0,
          activeBotIds: [],
        },
      },
    );

    const count = result.modifiedCount;
    if (count > 0) {
      logger.warn({ count, cutoffMs: HEARTBEAT_TIMEOUT_MS }, '[EngineService] Marked stale engines offline');
    }
    return count;
  }
}
