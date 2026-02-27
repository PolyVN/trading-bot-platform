import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

// ioredis ESM compat: default export is the Redis class constructor
const Redis = IORedis.default ?? IORedis;

function createRedisClient(name: string) {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  client.on('error', (err: Error) => {
    logger.error({ err: err.message }, `[Redis:${name}] Error`);
  });

  client.on('connect', () => {
    logger.info(`[Redis:${name}] Connected`);
  });

  return client;
}

// Separate connections for subscriber, publisher, cache (and BullMQ)
export const redisSub = createRedisClient('subscriber');
export const redisPub = createRedisClient('publisher');
export const redisCache = createRedisClient('cache');
export const redisBullMQ = createRedisClient('bullmq');

export function isRedisConnected(): boolean {
  return redisPub.status === 'ready';
}

export async function disconnectAllRedis(): Promise<void> {
  await Promise.all([
    redisSub.quit(),
    redisPub.quit(),
    redisCache.quit(),
    redisBullMQ.quit(),
  ]);
}
