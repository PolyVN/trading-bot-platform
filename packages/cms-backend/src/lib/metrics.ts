import client from 'prom-client';
import type { FastifyPluginAsync } from 'fastify';

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: 'cms_' });

export const httpRequestDuration = new client.Histogram({
  name: 'cms_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/metrics', async (_request, reply) => {
    const metrics = await client.register.metrics();
    return reply.type(client.register.contentType).send(metrics);
  });
};
