import type { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.js';
import { EngineService } from '../services/engine.service.js';
import { engineListQuerySchema } from '../validation/engine.schema.js';
import { handleError } from '../lib/route-utils.js';

export const engineRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/engines — List engines (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = engineListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await EngineService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/engines/:id — Get engine by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await EngineService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/engines/:id/drain — Drain engine (admin only)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/drain',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      try {
        return await EngineService.drain(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
