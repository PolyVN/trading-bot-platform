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

    const snapshots: Record<string, unknown>[] = [];

    // Per-bot snapshots
    for (const [botId, botTrades] of tradesByBot) {
      const bot = await Bot.findOne(mongoFilter({ botId })).lean();
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

    // Upsert all snapshots (idempotent)
    for (const snapshot of snapshots) {
      await PnL.findOneAndUpdate(
        mongoFilter({
          entityType: snapshot.entityType,
          entityId: snapshot.entityId,
          exchange: snapshot.exchange,
          period: snapshot.period,
          timestamp: snapshot.timestamp,
          isPaper: snapshot.isPaper,
        }),
        { $set: snapshot },
        { upsert: true },
      );
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
