import { Queue } from 'bullmq';
import { redisBullMQ } from '../lib/redis.js';
import { QUEUE_NAMES } from '../constants.js';

function createQueue(name: string): Queue {
  return new Queue(name, { connection: redisBullMQ });
}

export const orderQueue = createQueue(QUEUE_NAMES.orders);
export const tradeQueue = createQueue(QUEUE_NAMES.trades);
export const pnlQueue = createQueue(QUEUE_NAMES.pnl);
export const notificationQueue = createQueue(QUEUE_NAMES.notifications);
export const auditQueue = createQueue(QUEUE_NAMES.audit);
export const exchangeSyncQueue = createQueue(QUEUE_NAMES.exchangeSync);
