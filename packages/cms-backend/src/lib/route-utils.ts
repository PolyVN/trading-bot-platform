import type { FastifyReply } from 'fastify';

/**
 * Typed service error with explicit HTTP status code.
 * Use this in service methods instead of plain Error to ensure correct HTTP mapping.
 */
export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** 404 Not Found */
export class NotFoundError extends ServiceError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

/** 403 Forbidden */
export class ForbiddenError extends ServiceError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

/** 409 Conflict (state violations, duplicate, mismatch) */
export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(409, message);
  }
}

/** 400 Bad Request */
export class BadRequestError extends ServiceError {
  constructor(message: string) {
    super(400, message);
  }
}

/**
 * Centralized error handler for route catch blocks.
 * Maps ServiceError to its status code; unknown errors become 500.
 */
export function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ServiceError) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.status(500).send({ error: message });
}
