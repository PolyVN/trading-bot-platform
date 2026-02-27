import { Queue } from 'bullmq';
import { redisBullMQ } from '../lib/redis.js';

export const QUEUE_NAMES = {
  ORDER_PERSISTENCE: 'order-persistence',
  TRADE_PERSISTENCE: 'trade-persistence',
  POSITION_UPDATE: 'position-update',
  PNL_SNAPSHOT: 'pnl-snapshot',
  NOTIFICATION: 'notification',
  AUDIT_LOG: 'audit-log',
} as const;

function createQueue(name: string): Queue {
  return new Queue(name, { connection: redisBullMQ });
}

export const orderQueue = createQueue(QUEUE_NAMES.ORDER_PERSISTENCE);
export const tradeQueue = createQueue(QUEUE_NAMES.TRADE_PERSISTENCE);
export const positionQueue = createQueue(QUEUE_NAMES.POSITION_UPDATE);
export const pnlQueue = createQueue(QUEUE_NAMES.PNL_SNAPSHOT);
export const notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION);
export const auditQueue = createQueue(QUEUE_NAMES.AUDIT_LOG);
