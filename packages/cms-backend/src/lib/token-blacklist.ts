import crypto from 'node:crypto';
import { redisCache } from './redis.js';

const BLACKLIST_PREFIX = 'token:blacklist:';

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  await redisCache.set(`${BLACKLIST_PREFIX}${tokenHash(token)}`, '1', 'EX', ttlSeconds);
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redisCache.get(`${BLACKLIST_PREFIX}${tokenHash(token)}`);
  return result !== null;
}
