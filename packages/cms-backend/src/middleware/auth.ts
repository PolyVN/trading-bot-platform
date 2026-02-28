import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../lib/route-utils.js';

export interface AuthUser {
  sub: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  allowedExchanges: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

/**
 * Authenticate: verify JWT from Authorization header or cookie.
 * Attaches request.authUser on success.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded: any = await request.jwtVerify();
    request.authUser = {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      allowedExchanges: decoded.allowedExchanges ?? [],
    };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

type Role = 'admin' | 'operator' | 'viewer';

/**
 * Authorize: check user has one of the allowed roles.
 */
export function authorize(...allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(request.authUser.role)) {
      return reply
        .status(403)
        .send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}

/**
 * Exchange-scoped authorization for operators.
 * Extracts exchange from request (body, params, or query) and checks against user's allowedExchanges.
 */
export function authorizeExchange(
  exchangeExtractor: (req: FastifyRequest) => string | null | Promise<string | null>,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { role, allowedExchanges } = request.authUser;

    // Only admins bypass exchange scoping
    if (role === 'admin') return;

    // Operators: check allowedExchanges
    const exchange = await exchangeExtractor(request);
    if (!exchange) return; // non-exchange resource

    if (allowedExchanges.length > 0 && !allowedExchanges.includes(exchange)) {
      return reply
        .status(403)
        .send({ error: 'Forbidden', message: `No access to exchange: ${exchange}` });
    }
  };
}

/**
 * Build MongoDB exchange filter based on user permissions.
 */
export function buildExchangeFilter(user: AuthUser): Record<string, unknown> {
  if (user.role === 'admin') return {};
  if (user.allowedExchanges.length === 0) return {};
  return { exchange: { $in: user.allowedExchanges } };
}

/**
 * Check that user has access to the given exchange.
 * Admins bypass; operators checked against allowedExchanges.
 * Throws ForbiddenError if access denied.
 */
export function checkExchangeAccess(user: AuthUser, exchange: string): void {
  if (user.role === 'admin') return;
  if (user.allowedExchanges.length > 0 && !user.allowedExchanges.includes(exchange)) {
    throw new ForbiddenError(`No access to exchange: ${exchange}`);
  }
}

/**
 * Mongoose 9 filter helper for query typing.
 * Mongoose 9's strict typing rejects `Record<string, unknown>` as a filter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mongoFilter = (obj: Record<string, unknown>): any => obj;
