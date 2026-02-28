import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { botRoutes } from './routes/bots.js';
import { orderRoutes } from './routes/orders.js';
import { tradeRoutes } from './routes/trades.js';
import { walletRoutes } from './routes/wallets.js';
import { positionRoutes } from './routes/positions.js';
import { engineRoutes } from './routes/engines.js';
import { exchangeRoutes } from './routes/exchanges.js';
import { pnlRoutes } from './routes/pnl.js';
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
  await app.register(botRoutes, { prefix: '/api/bots' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(tradeRoutes, { prefix: '/api/trades' });
  await app.register(walletRoutes, { prefix: '/api/wallets' });
  await app.register(positionRoutes, { prefix: '/api/positions' });
  await app.register(engineRoutes, { prefix: '/api/engines' });
  await app.register(exchangeRoutes, { prefix: '/api/exchanges' });
  await app.register(pnlRoutes, { prefix: '/api/pnl' });

  return app;
}
