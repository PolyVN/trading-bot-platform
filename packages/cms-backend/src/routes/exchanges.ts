import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { ExchangeService } from '../services/exchange.service.js';
import { handleError } from '../lib/route-utils.js';

export const exchangeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/exchanges — List exchanges (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      try {
        return await ExchangeService.list();
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/exchanges/:exchange/status — Get exchange status (all roles)
   */
  app.get<{ Params: { exchange: string } }>(
    '/:exchange/status',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await ExchangeService.getStatus(request.params.exchange);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
