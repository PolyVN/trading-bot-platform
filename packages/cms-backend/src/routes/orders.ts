import type { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.js';
import { OrderService } from '../services/order.service.js';
import { manualOrderSchema, orderListQuerySchema } from '../validation/order.schema.js';
import { handleError } from '../lib/route-utils.js';

export const orderRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/orders — List orders (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = orderListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await OrderService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/orders/:id — Get order by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await OrderService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/orders/manual — Place a manual order (admin, operator)
   */
  app.post(
    '/manual',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      const parsed = manualOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }

      try {
        const order = await OrderService.placeManual(parsed.data as Record<string, unknown>, request.authUser);
        return reply.status(201).send(order);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/orders/:id/cancel — Cancel an order (admin, operator)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      try {
        await OrderService.cancel(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
