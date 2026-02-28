import type { FastifyPluginAsync } from 'fastify';
import { authenticate, buildExchangeFilter, mongoFilter } from '../middleware/auth.js';
import { PnL } from '../models/PnL.js';
import { pnlQuerySchema } from '../validation/pnl.schema.js';
import { handleError } from '../lib/route-utils.js';

export const pnlRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/pnl — Query PnL snapshots (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = pnlQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        const { entityType, entityId, exchange, period, isPaper, startDate, endDate } = parsed.data;

        // Build Mongo filter
        const exchangeFilter = buildExchangeFilter(request.authUser);
        const queryFilter: Record<string, unknown> = { ...exchangeFilter };

        queryFilter.entityType = entityType;
        queryFilter.period = period;

        if (entityId) queryFilter.entityId = entityId;

        // Merge query exchange filter with user's exchange filter
        if (exchange) {
          if (exchangeFilter.exchange) {
            const allowed = (exchangeFilter.exchange as { $in: string[] }).$in;
            if (!allowed.includes(exchange)) {
              return { data: [] };
            }
            queryFilter.exchange = exchange;
          } else {
            queryFilter.exchange = exchange;
          }
        }

        if (isPaper !== undefined) queryFilter.isPaper = isPaper;

        // Timestamp range
        if (startDate || endDate) {
          const timestampFilter: Record<string, Date> = {};
          if (startDate) timestampFilter.$gte = startDate;
          if (endDate) timestampFilter.$lte = endDate;
          queryFilter.timestamp = timestampFilter;
        }

        const data = await PnL.find(mongoFilter(queryFilter))
          .sort({ timestamp: -1 })
          .limit(1000)
          .lean();

        return { data };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
