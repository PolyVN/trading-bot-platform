import { z } from 'zod';
import { EXCHANGES } from '../constants.js';

// --- Pagination & filtering ---

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const exchangeFilterSchema = z.object({
  exchange: z.enum(EXCHANGES).optional(),
});

export const listQuerySchema = paginationSchema.merge(exchangeFilterSchema);

export type ListQuery = z.infer<typeof listQuerySchema>;

// --- Helpers ---

export function buildSortObject(sort: string | undefined, order: 'asc' | 'desc'): Record<string, 1 | -1> {
  if (!sort) return { createdAt: order === 'asc' ? 1 : -1 };
  return { [sort]: order === 'asc' ? 1 : -1 };
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// --- Shared field schemas ---

export const exchangeSchema = z.enum(EXCHANGES);
export const botIdSchema = z.string().min(1);
export const decimalSchema = z.coerce.number().nonnegative();
export const positiveDecimalSchema = z.coerce.number().positive();
