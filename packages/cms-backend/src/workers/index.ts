import { Queue } from 'bullmq';
import { redisBullMQ } from '../lib/redis.js';
import { QUEUE_NAMES } from '../constants.js';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1s → 2s → 4s
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: redisBullMQ,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export const orderQueue = createQueue(QUEUE_NAMES.orders);
export const tradeQueue = createQueue(QUEUE_NAMES.trades);
export const pnlQueue = createQueue(QUEUE_NAMES.pnl);
export const notificationQueue = createQueue(QUEUE_NAMES.notifications);
export const auditQueue = createQueue(QUEUE_NAMES.audit);
export const exchangeSyncQueue = createQueue(QUEUE_NAMES.exchangeSync);

/** Dead Letter Queue for permanently failed jobs across all workers. */
export const dlqQueue = createQueue('dlq');
