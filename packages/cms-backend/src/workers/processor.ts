import { Worker, Job } from 'bullmq';
import { redisBullMQ } from '../lib/redis.js';
import { QUEUE_NAMES } from '../constants.js';
import { logger } from '../lib/logger.js';
import { Order } from '../models/Order.js';
import { Trade } from '../models/Trade.js';
import { PnL } from '../models/PnL.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';

// Helper for Mongoose 9 filter typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filter = (obj: Record<string, unknown>): any => obj;

const workers: Worker[] = [];

async function processOrderJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id, orderId: data.orderId }, '[Worker:orders] Processing');
  await Order.findOneAndUpdate(
    filter({ orderId: data.orderId }),
    { $set: data },
    { upsert: true },
  );
}

async function processTradeJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id, tradeId: data.tradeId }, '[Worker:trades] Processing');
  await Trade.findOneAndUpdate(
    filter({ tradeId: data.tradeId }),
    { $set: data },
    { upsert: true },
  );
}

async function processPnlJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id }, '[Worker:pnl] Processing');
  await PnL.create(data);
}

async function processNotificationJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id }, '[Worker:notifications] Processing');
  await Notification.create(data);
}

async function processAuditJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id }, '[Worker:audit] Processing');
  await AuditLog.create(data);
}

function createWorker(queueName: string, processor: (job: Job) => Promise<void>): Worker {
  const worker = new Worker(queueName, processor, {
    connection: redisBullMQ,
    concurrency: 5,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, `[Worker:${queueName}] Job failed`);
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, `[Worker:${queueName}] Error`);
  });

  return worker;
}

export function startWorkers(): void {
  workers.push(
    createWorker(QUEUE_NAMES.orders, processOrderJob),
    createWorker(QUEUE_NAMES.trades, processTradeJob),
    createWorker(QUEUE_NAMES.pnl, processPnlJob),
    createWorker(QUEUE_NAMES.notifications, processNotificationJob),
    createWorker(QUEUE_NAMES.audit, processAuditJob),
  );

  logger.info(`[Workers] Started ${workers.length} queue workers`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  logger.info('[Workers] All workers stopped');
}
