import type { AuthUser } from '../middleware/auth.js';
import { buildExchangeFilter, mongoFilter } from '../middleware/auth.js';
import { PnL } from '../models/PnL.js';
import { Trade } from '../models/Trade.js';
import { Bot } from '../models/Bot.js';
import { logger } from '../lib/logger.js';

/**
 * Currency rates to USD equivalent.
 * USDC and USDT treated as 1:1 with USD per architecture docs.
 * Extend this map for additional currencies as needed.
 */
const CURRENCY_RATES_TO_USD: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  USD: 1.0,
};

function toUsd(amount: number, currency: string): number {
  return amount * (CURRENCY_RATES_TO_USD[currency] ?? 1.0);
}

interface PnLListQuery {
  entityType: string;
  entityId?: string;
  exchange?: string;
  period: string;
  startDate?: Date;
  endDate?: Date;
  isPaper?: boolean;
}

export class PnLService {
  /**
   * List PnL snapshots with exchange-scoped filtering.
   */
  static async list(query: PnLListQuery, user: AuthUser) {
    const { entityType, entityId, exchange, period, isPaper, startDate, endDate } = query;

    const exchangeFilter = buildExchangeFilter(user);
    const queryFilter: Record<string, unknown> = { ...exchangeFilter };

    queryFilter.entityType = entityType;
    queryFilter.period = period;

    if (entityId) queryFilter.entityId = entityId;

    if (exchange) {
      if (exchangeFilter.exchange) {
        const allowed = (exchangeFilter.exchange as { $in: string[] }).$in;
        if (!allowed.includes(exchange)) {
          return { data: [] };
        }
        queryFilter.exchange = exchange;
      } else {
        queryFilter.exchange = exchange;
      }
    }

    if (isPaper !== undefined) queryFilter.isPaper = isPaper;

    if (startDate || endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (startDate) timestampFilter.$gte = startDate;
      if (endDate) timestampFilter.$lte = endDate;
      queryFilter.timestamp = timestampFilter;
    }

    const data = await PnL.find(mongoFilter(queryFilter))
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();

    return { data };
  }

  /**
   * Create hourly PnL snapshots for all bots with trades in the current hour.
   * Also creates per-exchange and global aggregate snapshots.
   */
  static async createHourlySnapshots(): Promise<number> {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const trades = await Trade.find(mongoFilter({
      timestamp: { $gte: hourStart, $lt: hourEnd },
    })).lean();

    if (trades.length === 0) {
      logger.debug('[PnL] No trades in current hour, skipping snapshot');
      return 0;
    }

    // Group trades by bot
    const tradesByBot = new Map<string, typeof trades>();
    for (const trade of trades) {
      const list = tradesByBot.get(trade.botId) ?? [];
      list.push(trade);
      tradesByBot.set(trade.botId, list);
    }

    // Batch bot lookup (avoids N+1 queries)
    const botIds = [...tradesByBot.keys()];
    const bots = await Bot.find(mongoFilter({ botId: { $in: botIds } })).lean();
    const botMap = new Map(bots.map((b) => [b.botId, b]));

    const snapshots: Record<string, unknown>[] = [];

    // Per-bot snapshots
    for (const [botId, botTrades] of tradesByBot) {
      const bot = botMap.get(botId);
      if (!bot) continue;

      const metrics = PnLService.calculateTradeMetrics(botTrades);
      snapshots.push({
        entityType: 'bot',
        entityId: botId,
        exchange: bot.exchange,
        period: '1h',
        timestamp: hourStart,
        currency: botTrades[0]?.currency ?? 'USDC',
        isPaper: bot.mode === 'paper',
        ...metrics,
      });
    }

    // Per-exchange snapshots
    const tradesByExchange = new Map<string, typeof trades>();
    for (const trade of trades) {
      const list = tradesByExchange.get(trade.exchange) ?? [];
      list.push(trade);
      tradesByExchange.set(trade.exchange, list);
    }

    for (const [exchange, exchangeTrades] of tradesByExchange) {
      const metrics = PnLService.calculateTradeMetrics(exchangeTrades);
      snapshots.push({
        entityType: 'exchange',
        entityId: exchange,
        exchange,
        period: '1h',
        timestamp: hourStart,
        currency: 'USDC',
        isPaper: false,
        ...metrics,
      });
    }

    // Global snapshot
    const globalMetrics = PnLService.calculateTradeMetrics(trades);
    snapshots.push({
      entityType: 'total',
      entityId: 'global',
      exchange: 'all',
      period: '1h',
      timestamp: hourStart,
      currency: 'USDC',
      isPaper: false,
      ...globalMetrics,
    });

    // Bulk upsert all snapshots (idempotent)
    if (snapshots.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ops: any[] = snapshots.map((snapshot) => ({
        updateOne: {
          filter: {
            entityType: snapshot.entityType,
            entityId: snapshot.entityId,
            exchange: snapshot.exchange,
            period: snapshot.period,
            timestamp: snapshot.timestamp,
            isPaper: snapshot.isPaper,
          },
          update: { $set: snapshot },
          upsert: true,
        },
      }));
      await PnL.bulkWrite(ops);
    }

    logger.info({ count: snapshots.length }, '[PnL] Hourly snapshots created');
    return snapshots.length;
  }

  /**
   * Aggregate hourly snapshots into a larger period (4h, 1d, 1w).
   */
  static async aggregateSnapshots(
    entityType: string,
    entityId: string,
    exchange: string,
    targetPeriod: string,
    startDate: Date,
    endDate: Date,
    isPaper: boolean,
  ): Promise<void> {
    const snapshots = await PnL.find(mongoFilter({
      entityType,
      entityId,
      exchange,
      period: '1h',
      isPaper,
      timestamp: { $gte: startDate, $lt: endDate },
    })).lean();

    if (snapshots.length === 0) return;

    let realizedPnl = 0;
    let realizedPnlUsd = 0;
    let totalVolume = 0;
    let totalVolumeUsd = 0;
    let tradeCount = 0;
    let winCount = 0;
    let lossCount = 0;
    let totalFees = 0;
    let totalFeesUsd = 0;

    for (const s of snapshots) {
      realizedPnl += parseFloat(String(s.realizedPnl ?? 0));
      realizedPnlUsd += parseFloat(String(s.realizedPnlUsd ?? 0));
      totalVolume += parseFloat(String(s.totalVolume ?? 0));
      totalVolumeUsd += parseFloat(String(s.totalVolumeUsd ?? 0));
      tradeCount += s.tradeCount ?? 0;
      winCount += s.winCount ?? 0;
      lossCount += s.lossCount ?? 0;
      totalFees += parseFloat(String(s.fees ?? 0));
      totalFeesUsd += parseFloat(String(s.feesUsd ?? 0));
    }

    const winRate = tradeCount > 0 ? winCount / tradeCount : 0;

    await PnL.findOneAndUpdate(
      mongoFilter({
        entityType,
        entityId,
        exchange,
        period: targetPeriod,
        timestamp: startDate,
        isPaper,
      }),
      {
        $set: {
          entityType,
          entityId,
          exchange,
          period: targetPeriod,
          timestamp: startDate,
          currency: 'USDC',
          isPaper,
          realizedPnl,
          realizedPnlUsd,
          unrealizedPnl: 0,
          unrealizedPnlUsd: 0,
          totalPnl: realizedPnl,
          totalPnlUsd: realizedPnlUsd,
          totalVolume,
          totalVolumeUsd,
          tradeCount,
          winCount,
          lossCount,
          winRate: Math.round(winRate * 10000) / 10000,
          fees: totalFees,
          feesUsd: totalFeesUsd,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Run daily aggregation: roll up hourly snapshots into 1d periods.
   * Also creates weekly (1w) aggregations on Sundays.
   * Called by the scheduled BullMQ job at 00:05 daily.
   */
  static async runDailyAggregation(): Promise<void> {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    // Aggregate the previous day
    const prevDayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const prevDayEnd = dayStart;

    // Find all distinct entity combinations from hourly snapshots in the previous day
    const hourlies = await PnL.find(mongoFilter({
      period: '1h',
      timestamp: { $gte: prevDayStart, $lt: prevDayEnd },
    }))
      .select('entityType entityId exchange isPaper')
      .lean();

    // Deduplicate by composite key
    const seen = new Set<string>();
    const entities: { entityType: string; entityId: string; exchange: string; isPaper: boolean }[] = [];
    for (const h of hourlies) {
      const key = `${h.entityType}:${h.entityId}:${h.exchange}:${h.isPaper}`;
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({
          entityType: h.entityType as string,
          entityId: h.entityId as string,
          exchange: h.exchange as string,
          isPaper: h.isPaper as boolean,
        });
      }
    }

    // Daily aggregation
    for (const e of entities) {
      await PnLService.aggregateSnapshots(
        e.entityType, e.entityId, e.exchange, '1d',
        prevDayStart, prevDayEnd, e.isPaper,
      );
    }

    // Weekly aggregation (on Mondays, aggregate the previous week Sun-Sat)
    if (now.getDay() === 1) {
      const weekStart = new Date(prevDayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      for (const e of entities) {
        await PnLService.aggregateSnapshots(
          e.entityType, e.entityId, e.exchange, '1w',
          weekStart, prevDayEnd, e.isPaper,
        );
      }
    }

    logger.info({ entities: entities.length, day: prevDayStart.toISOString() }, '[PnL] Daily aggregation done');
  }

  /**
   * Calculate PnL metrics from a set of trade documents.
   * Normalizes all values to USDC equivalent.
   */
  static calculateTradeMetrics(trades: Record<string, unknown>[]) {
    let realizedPnl = 0;
    let realizedPnlUsd = 0;
    let totalVolume = 0;
    let totalVolumeUsd = 0;
    let totalFees = 0;
    let totalFeesUsd = 0;
    let winCount = 0;
    let lossCount = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;

    for (const trade of trades) {
      const pnl = parseFloat(String(trade.realizedPnl ?? 0));
      const currency = (trade.currency as string) ?? 'USDC';
      const pnlUsd = toUsd(pnl, currency);
      const size = parseFloat(String(trade.size ?? 0));
      const price = parseFloat(String(trade.price ?? 0));
      const fee = parseFloat(String(trade.fee ?? 0));
      const volume = size * price;

      realizedPnl += pnl;
      realizedPnlUsd += pnlUsd;
      totalVolume += volume;
      totalVolumeUsd += toUsd(volume, currency);
      totalFees += fee;
      totalFeesUsd += toUsd(fee, currency);

      if (pnl > 0) {
        winCount++;
        totalWinPnl += pnl;
      } else if (pnl < 0) {
        lossCount++;
        totalLossPnl += Math.abs(pnl);
      }
    }

    const tradeCount = trades.length;
    const winRate = tradeCount > 0 ? winCount / tradeCount : 0;
    const avgWin = winCount > 0 ? totalWinPnl / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 0;

    return {
      realizedPnl,
      realizedPnlUsd,
      unrealizedPnl: 0,
      unrealizedPnlUsd: 0,
      totalPnl: realizedPnl,
      totalPnlUsd: realizedPnlUsd,
      totalVolume,
      totalVolumeUsd,
      tradeCount,
      winCount,
      lossCount,
      winRate: Math.round(winRate * 10000) / 10000,
      avgWin,
      avgLoss,
      fees: totalFees,
      feesUsd: totalFeesUsd,
    };
  }
}
