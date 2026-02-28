import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { TradeService } from '../services/trade.service.js';
import { listQuerySchema } from '../validation/common.js';
import { handleError } from '../lib/route-utils.js';

// Inline trade list query schema (no dedicated schema file for trades)
const tradeListQuerySchema = listQuerySchema.extend({
  botId: z.string().optional(),
  instId: z.string().optional(),
  isPaper: z.coerce.boolean().optional(),
});

export const tradeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/trades — List trades (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = tradeListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await TradeService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/trades/:id — Get trade by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await TradeService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
