import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { PositionService } from '../services/position.service.js';
import { positionListQuerySchema } from '../validation/position.schema.js';
import { handleError } from '../lib/route-utils.js';

export const positionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/positions — List positions (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = positionListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await PositionService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/positions/:id — Get position by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await PositionService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
