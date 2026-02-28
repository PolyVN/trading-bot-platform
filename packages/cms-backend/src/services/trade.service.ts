import type { AuthUser } from '../middleware/auth.js';
import { buildExchangeFilter, checkExchangeAccess, mongoFilter } from '../middleware/auth.js';
import { Trade } from '../models/Trade.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError } from '../lib/route-utils.js';

interface TradeListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  exchange?: string;
  botId?: string;
  instId?: string;
  isPaper?: boolean;
}

export class TradeService {
  static async list(query: TradeListQuery, user: AuthUser) {
    const {
      page = 1,
      limit = 50,
      sort,
      order = 'desc',
      exchange,
      botId,
      instId,
      isPaper,
    } = query;

    const exchangeFilter = buildExchangeFilter(user);
    const queryFilter: Record<string, unknown> = { ...exchangeFilter };

    if (exchange) {
      if (exchangeFilter.exchange) {
        const allowed = (exchangeFilter.exchange as { $in: string[] }).$in;
        if (!allowed.includes(exchange)) {
          return buildPaginatedResponse([], 0, page, limit);
        }
        queryFilter.exchange = exchange;
      } else {
        queryFilter.exchange = exchange;
      }
    }

    if (botId) queryFilter.botId = botId;
    if (instId) queryFilter.instId = instId;
    if (isPaper !== undefined) queryFilter.isPaper = isPaper;

    const sortObj = buildSortObject(sort, order);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Trade.find(mongoFilter(queryFilter)).sort(sortObj).skip(skip).limit(limit).lean(),
      Trade.countDocuments(mongoFilter(queryFilter)),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  static async getById(tradeId: string, user: AuthUser) {
    const trade = await Trade.findOne(mongoFilter({ tradeId })).lean();
    if (!trade) throw new NotFoundError('Trade not found');

    checkExchangeAccess(user, trade.exchange);
    return trade;
  }
}
