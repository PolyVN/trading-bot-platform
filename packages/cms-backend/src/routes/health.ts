import type { FastifyPluginAsync } from 'fastify';
import { isMongoConnected } from '../lib/mongoose.js';
import { isRedisConnected } from '../lib/redis.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    const mongoStatus = isMongoConnected() ? 'connected' : 'disconnected';
    const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';
    const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';

    const body = {
      status: isHealthy ? 'ok' : 'error',
      timestamp: Date.now(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    };

    return reply.status(isHealthy ? 200 : 503).send(body);
  });
};
