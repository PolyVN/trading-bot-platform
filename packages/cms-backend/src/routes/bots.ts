import type { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.js';
import { BotService } from '../services/bot.service.js';
import { createBotSchema, updateBotSchema, botListQuerySchema } from '../validation/bot.schema.js';
import { handleError } from '../lib/route-utils.js';

export const botRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/bots — Create a new bot (admin, operator)
   */
  app.post(
    '/',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      const parsed = createBotSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }

      try {
        const bot = await BotService.create(parsed.data as Record<string, unknown>, request.authUser);
        return reply.status(201).send(bot);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/bots — List bots (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = botListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await BotService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/bots/:id — Get bot by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await BotService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * PATCH /api/bots/:id — Update bot (admin, operator)
   */
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      const parsed = updateBotSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }

      try {
        const bot = await BotService.update(request.params.id, parsed.data as Record<string, unknown>, request.authUser);
        return bot;
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * DELETE /api/bots/:id — Delete bot (admin only)
   */
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      try {
        await BotService.delete(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/bots/:id/start — Start bot (admin, operator)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/start',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      try {
        await BotService.start(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/bots/:id/stop — Stop bot (admin, operator)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/stop',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      try {
        await BotService.stop(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/bots/:id/pause — Pause bot (admin, operator)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/pause',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      try {
        await BotService.pause(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/bots/:id/resume — Resume bot (admin, operator)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/resume',
    { preHandler: [authenticate, authorize('admin', 'operator')] },
    async (request, reply) => {
      try {
        await BotService.resume(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
