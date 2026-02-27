import { buildApp } from './app.js';
import { config } from './config.js';
import { connectMongoDB, disconnectMongoDB } from './lib/mongoose.js';
import { disconnectAllRedis, redisPub } from './lib/redis.js';
import { seedAdminUser } from './services/seed.js';
import { startRedisSubscriber, stopRedisSubscriber } from './services/redis-subscriber.js';
import { startWorkers, stopWorkers } from './workers/processor.js';

async function main() {
  const app = await buildApp();

  // Connect to MongoDB
  try {
    await connectMongoDB();
    app.log.info('[MongoDB] Connected');
  } catch (err) {
    app.log.error(err, '[MongoDB] Failed to connect');
    process.exit(1);
  }

  // Wait for Redis to be ready
  try {
    await redisPub.ping();
    app.log.info('[Redis] Connected');
  } catch (err) {
    app.log.error(err, '[Redis] Failed to connect');
    process.exit(1);
  }

  // Seed admin user on first run
  await seedAdminUser(app.log);

  // Start Redis subscriber + BullMQ workers
  await startRedisSubscriber();
  startWorkers();

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`CMS Backend listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await stopRedisSubscriber();
    await app.close();
    await stopWorkers();
    await disconnectMongoDB();
    await disconnectAllRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
