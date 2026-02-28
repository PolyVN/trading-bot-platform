import { Worker, Job } from 'bullmq';
import { redisBullMQ } from '../lib/redis.js';
import { QUEUE_NAMES } from '../constants.js';
import { logger } from '../lib/logger.js';
import { mongoFilter } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { Trade } from '../models/Trade.js';
import { PnL } from '../models/PnL.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';
import { dlqQueue, pnlQueue } from './index.js';
import { config } from '../config.js';
import { PnLService } from '../services/pnl.service.js';

const workers: Worker[] = [];

async function processOrderJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id, orderId: data.orderId }, '[Worker:orders] Processing');

  // Build update with timeline append for status changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { $set: { ...data } };

  if (data.status) {
    // Remove timeline from $set — we push it separately
    delete update.$set.timeline;
    update.$push = {
      timeline: {
        status: data.status,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        details: data.statusReason ?? `Status updated to ${data.status}`,
      },
    };
  }

  await Order.findOneAndUpdate(
    mongoFilter({ orderId: data.orderId }),
    update,
    { upsert: true },
  );
}

async function processTradeJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id, tradeId: data.tradeId }, '[Worker:trades] Processing');
  await Trade.findOneAndUpdate(
    mongoFilter({ tradeId: data.tradeId }),
    { $set: data },
    { upsert: true },
  );
}

async function processPnlJob(job: Job): Promise<void> {
  if (job.name === 'pnl-hourly-snapshot') {
    logger.info({ jobId: job.id }, '[Worker:pnl] Running hourly snapshot');
    const count = await PnLService.createHourlySnapshots();
    logger.info({ jobId: job.id, snapshots: count }, '[Worker:pnl] Hourly snapshot complete');
    return;
  }

  const data = job.data;
  logger.debug({ jobId: job.id }, '[Worker:pnl] Processing');
  await PnL.create(data);
}

async function processNotificationJob(job: Job): Promise<void> {
  const data = job.data;
  logger.debug({ jobId: job.id, type: data.type }, '[Worker:notifications] Processing');

  const notification = await Notification.create(data);

  // Attempt Telegram delivery for critical notifications (best-effort)
  if (data.severity === 'critical' && config.telegram.botToken && config.telegram.chatId) {
    try {
      const text = `*${data.title}*\n${data.message}`;
      const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      await Notification.updateOne(
        mongoFilter({ notificationId: notification.notificationId }),
        { $set: { sentViaTelegram: true } },
      );
      logger.info({ notificationId: data.notificationId }, '[Worker:notifications] Telegram sent');
    } catch (err) {
      logger.warn({ err, notificationId: data.notificationId }, '[Worker:notifications] Telegram failed');
      // Don't fail the job — notification is persisted, Telegram is best-effort
    }
  }
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
    const attempts = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;

    if (attempts >= maxAttempts) {
      // All retries exhausted — move to DLQ
      logger.error(
        { jobId: job?.id, err: err.message, attempts },
        `[Worker:${queueName}] Job permanently failed, moving to DLQ`,
      );
      dlqQueue
        .add(`dlq:${queueName}`, {
          originalQueue: queueName,
          jobId: job?.id,
          data: job?.data,
          error: err.message,
          failedAt: new Date().toISOString(),
          attempts,
        })
        .catch((dlqErr) => {
          logger.error({ dlqErr }, `[Worker:${queueName}] Failed to enqueue to DLQ`);
        });
    } else {
      logger.warn(
        { jobId: job?.id, err: err.message, attempt: attempts, maxAttempts },
        `[Worker:${queueName}] Job failed, will retry`,
      );
    }
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

  // Schedule hourly PnL snapshot as a repeatable job
  pnlQueue
    .add('pnl-hourly-snapshot', {}, {
      repeat: { pattern: '0 * * * *' }, // every hour at :00
      jobId: 'pnl-hourly-snapshot',
    })
    .catch((err) => {
      logger.error({ err }, '[Workers] Failed to schedule PnL hourly snapshot');
    });

  logger.info(`[Workers] Started ${workers.length} queue workers`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  logger.info('[Workers] All workers stopped');
}
