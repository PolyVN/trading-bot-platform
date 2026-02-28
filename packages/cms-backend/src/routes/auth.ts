import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate, authorize, mongoFilter } from '../middleware/auth.js';
import { blacklistToken, isTokenBlacklisted } from '../lib/token-blacklist.js';
import { EXCHANGES } from '../constants.js';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// --- Zod validation schemas ---

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator', 'viewer']),
  allowedExchanges: z.array(z.enum(EXCHANGES)).optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  allowedExchanges: z.array(z.enum(EXCHANGES)).optional(),
  isActive: z.boolean().optional(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/auth/login — stricter rate limit to prevent brute-force
   */
  app.post('/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    const { email, password } = parsed.data;

    const user = await User.findOne(mongoFilter({ email: email.toLowerCase(), isActive: true }));
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.get('passwordHash') as string);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Update lastLogin
    user.set('lastLogin', new Date());
    await user.save();

    const payload = {
      sub: user.get('userId') as string,
      email: user.get('email') as string,
      role: user.get('role') as 'admin' | 'operator' | 'viewer',
      allowedExchanges: (user.get('allowedExchanges') as string[]) ?? [],
    };

    const accessToken = app.jwt.sign(payload, {
      expiresIn: app.config.jwt.accessExpiresIn,
    });

    const refreshToken = app.jwt.sign(payload, {
      expiresIn: app.config.jwt.refreshExpiresIn,
    });

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: !app.config.isDev,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });

    return {
      accessToken,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        allowedExchanges: payload.allowedExchanges,
      },
    };
  });

  /**
   * POST /api/auth/refresh
   */
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    // Check blacklist
    if (await isTokenBlacklisted(token)) {
      return reply.status(401).send({ error: 'Token has been revoked' });
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded: any = app.jwt.verify(token);

      // Re-fetch user to get latest role/permissions
      const user = await User.findOne(mongoFilter({ userId: decoded.sub, isActive: true }));
      if (!user) {
        return reply.status(401).send({ error: 'User not found or inactive' });
      }

      const payload = {
        sub: user.get('userId') as string,
        email: user.get('email') as string,
        role: user.get('role') as 'admin' | 'operator' | 'viewer',
        allowedExchanges: (user.get('allowedExchanges') as string[]) ?? [],
      };

      const accessToken = app.jwt.sign(payload, {
        expiresIn: app.config.jwt.accessExpiresIn,
      });

      return {
        accessToken,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          allowedExchanges: payload.allowedExchanges,
        },
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  /**
   * POST /api/auth/logout
   */
  app.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (token) {
      await blacklistToken(token, REFRESH_TOKEN_TTL_SECONDS);
    }
    reply.clearCookie('refreshToken', { path: '/api/auth' });
    return { ok: true };
  });

  /**
   * GET /api/auth/me
   */
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await User.findOne(mongoFilter({ userId: request.authUser.sub }));
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return {
      id: user.get('userId'),
      email: user.get('email'),
      role: user.get('role'),
      allowedExchanges: user.get('allowedExchanges'),
      isActive: user.get('isActive'),
      lastLogin: user.get('lastLogin'),
      createdAt: user.get('createdAt'),
    };
  });

  /**
   * GET /api/auth/users — List users (admin only)
   */
  app.get(
    '/users',
    { preHandler: [authenticate, authorize('admin')] },
    async () => {
      const users = await User.find().sort({ createdAt: -1 }).lean();
      return users.map((u) => ({
        id: u.userId,
        email: u.email,
        role: u.role,
        allowedExchanges: u.allowedExchanges,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      }));
    },
  );

  /**
   * POST /api/auth/users — Create user (admin only)
   */
  app.post(
    '/users',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }
      const { email, password, role, allowedExchanges } = parsed.data;

      const existing = await User.findOne(mongoFilter({ email: email.toLowerCase() }));
      if (existing) {
        return reply.status(409).send({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const userId = crypto.randomUUID();

      const user = await User.create({
        userId,
        email: email.toLowerCase(),
        passwordHash,
        role,
        allowedExchanges: allowedExchanges ?? [],
        isActive: true,
      });

      return reply.status(201).send({
        id: user.get('userId'),
        email: user.get('email'),
        role: user.get('role'),
        allowedExchanges: user.get('allowedExchanges'),
        isActive: user.get('isActive'),
        createdAt: user.get('createdAt'),
      });
    },
  );

  /**
   * PATCH /api/auth/users/:id — Update user (admin only)
   */
  app.patch<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });
      }

      // Only allow known fields through
      const { role, allowedExchanges, isActive } = parsed.data;
      const updates: Record<string, unknown> = {};
      if (role !== undefined) updates.role = role;
      if (allowedExchanges !== undefined) updates.allowedExchanges = allowedExchanges;
      if (isActive !== undefined) updates.isActive = isActive;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No valid fields to update' });
      }

      const user = await User.findOneAndUpdate(
        mongoFilter({ userId: id }),
        { $set: updates },
        { new: true },
      );

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        id: user.get('userId'),
        email: user.get('email'),
        role: user.get('role'),
        allowedExchanges: user.get('allowedExchanges'),
        isActive: user.get('isActive'),
      };
    },
  );

  /**
   * DELETE /api/auth/users/:id — Delete user (admin only)
   */
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [authenticate, authorize('admin')] },
    async (request, reply) => {
      const { id } = request.params;

      // Prevent admins from deleting themselves
      if (id === request.authUser.sub) {
        return reply.status(400).send({ error: 'Cannot delete your own account' });
      }

      const result = await User.findOneAndDelete(mongoFilter({ userId: id }));
      if (!result) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return { ok: true };
    },
  );
};
