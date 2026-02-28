import { redisSub } from '../lib/redis.js';
import { getIO } from '../lib/socket.js';
import { logger } from '../lib/logger.js';
import { mongoFilter } from '../middleware/auth.js';
import { orderQueue, tradeQueue, auditQueue, notificationQueue } from '../workers/index.js';
import { Position } from '../models/Position.js';

/**
 * TE channel patterns for pattern-based subscription.
 * TE publishes to channels like `te:bot:status:{engineId}`.
 * We subscribe with patterns to capture all engine IDs.
 *
 * NOTE: These patterns must stay in sync with REDIS_CHANNELS in
 * shared-types/generated/ts/runtime-constants.ts. Pattern-based subscription
 * uses wildcards which cannot be derived from the function-based channel constructors.
 */
const TE_CHANNEL_PATTERNS = [
  'te:bot:status:*',
  'te:bot:heartbeat:*',
  'te:order:update:*',
  'te:trade:new:*',
  'te:position:update:*',
  'te:risk:alert:*',
  'te:market:resolved:*',
  'te:system:health:*',
  'te:engine:register',
  'te:engine:heartbeat',
  'te:engine:shutdown',
  'te:exchange:status:*',
  'te:exchange:rateLimit:*',
];

/**
 * Emit a TE event to appropriate Socket.IO rooms based on event data.
 * Rooms: bot:{botId}, exchange:{exchange}, global (always).
 */
function emitToRooms(channel: string, data: Record<string, unknown>): void {
  try {
    const io = getIO();
    const exchange = data.exchange as string | undefined;
    const botId = data.botId as string | undefined;

    if (botId) io.to(`bot:${botId}`).emit(channel, data);
    if (exchange) io.to(`exchange:${exchange}`).emit(channel, data);
    io.to('global').emit(channel, data);
  } catch {
    // Socket.IO may not be initialized during startup
  }
}

/**
 * Relay TE events to Socket.IO rooms and enqueue persistent jobs via BullMQ.
 */
function handleMessage(channel: string, message: string): void {
  try {
    const data = JSON.parse(message);

    // Relay all TE events to Socket.IO rooms
    emitToRooms(channel, data);

    // Enqueue persistent jobs for specific event types
    if (channel.startsWith('te:order:update:')) {
      orderQueue.add('order-update', data).catch((err) => {
        logger.error({ err }, '[Subscriber] Failed to enqueue order job');
      });
    } else if (channel.startsWith('te:trade:new:')) {
      tradeQueue.add('trade-new', data).catch((err) => {
        logger.error({ err }, '[Subscriber] Failed to enqueue trade job');
      });
    } else if (channel.startsWith('te:position:update:')) {
      // Position updates are persisted directly (no BullMQ queue for positions)
      Position.findOneAndUpdate(
        mongoFilter({ positionId: data.positionId }),
        { $set: data },
        { upsert: true },
      ).catch((err) => {
        logger.error({ err }, '[Subscriber] Failed to persist position update');
      });
    } else if (channel.startsWith('te:risk:alert:')) {
      notificationQueue.add('risk-alert', data).catch((err) => {
        logger.error({ err }, '[Subscriber] Failed to enqueue notification job');
      });
    } else if (channel.startsWith('te:engine:register') || channel.startsWith('te:engine:shutdown')) {
      auditQueue.add('engine-lifecycle', data).catch((err) => {
        logger.error({ err }, '[Subscriber] Failed to enqueue audit job');
      });
    }
  } catch (err) {
    logger.error({ err, channel }, '[Subscriber] Failed to parse message');
  }
}

/**
 * Start the Redis Pub/Sub subscriber.
 * Subscribes to all TE channel patterns and relays events.
 */
export async function startRedisSubscriber(): Promise<void> {
  // Use psubscribe for wildcard patterns, subscribe for exact channels
  const exactChannels = TE_CHANNEL_PATTERNS.filter((p) => !p.includes('*'));
  const patternChannels = TE_CHANNEL_PATTERNS.filter((p) => p.includes('*'));

  if (exactChannels.length > 0) {
    await redisSub.subscribe(...exactChannels);
  }
  if (patternChannels.length > 0) {
    await redisSub.psubscribe(...patternChannels);
  }

  redisSub.on('message', handleMessage);
  redisSub.on('pmessage', (_pattern, channel, message) => {
    handleMessage(channel, message);
  });

  logger.info(
    `[Subscriber] Listening on ${exactChannels.length} channels + ${patternChannels.length} patterns`,
  );
}

/**
 * Stop the Redis Pub/Sub subscriber.
 * Unsubscribes from all channels to prevent errors during shutdown.
 */
export async function stopRedisSubscriber(): Promise<void> {
  redisSub.removeAllListeners('message');
  redisSub.removeAllListeners('pmessage');
  await redisSub.unsubscribe();
  await redisSub.punsubscribe();
  logger.info('[Subscriber] Stopped');
}
