import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { metricsRoutes } from './lib/metrics.js';
import { setupSocketIO } from './lib/socket.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.isDev ? 'debug' : 'info',
      transport: config.isDev
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // --- Plugins ---
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  });

  // --- Decorators ---
  app.decorate('config', config);

  // --- Socket.IO ---
  setupSocketIO(app);

  // --- Routes ---
  await app.register(healthRoutes, { prefix: '/api/system' });
  await app.register(metricsRoutes, { prefix: '/api/system' });
  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}
