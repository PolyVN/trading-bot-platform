import type { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.js';
import { WalletService } from '../services/wallet.service.js';
import { createWalletSchema, walletListQuerySchema } from '../validation/wallet.schema.js';
import { handleError } from '../lib/route-utils.js';

export const walletRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/wallets — List wallets (all roles)
   */
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = walletListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      try {
        return await WalletService.list(parsed.data, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /api/wallets/:id — Get wallet by ID (all roles)
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        return await WalletService.getById(request.params.id, request.authUser);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * POST /api/wallets — Create a new wallet (admin only)
   */
  app.post(
    '/',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      const parsed = createWalletSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }

      try {
        const wallet = await WalletService.create(parsed.data as Record<string, unknown>, request.authUser);
        return reply.status(201).send(wallet);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * DELETE /api/wallets/:id — Delete wallet (admin only)
   */
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      try {
        await WalletService.delete(request.params.id, request.authUser);
        return { ok: true };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
};
