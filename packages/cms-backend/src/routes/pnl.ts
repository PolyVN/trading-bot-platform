import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { PnLService } from '../services/pnl.service.js';
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
        return await PnLService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
