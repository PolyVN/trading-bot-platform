import { mongoFilter } from '../middleware/auth.js';
import { ExchangeConfigModel } from '../models/ExchangeConfig.js';
import { NotFoundError } from '../lib/route-utils.js';

export class ExchangeService {
  static async list() {
    return ExchangeConfigModel.find().lean();
  }

  static async getStatus(exchange: string) {
    const exchangeConfig = await ExchangeConfigModel.findOne(mongoFilter({ exchange })).lean();
    if (!exchangeConfig) throw new NotFoundError(`Exchange config not found for: ${exchange}`);
    return exchangeConfig;
  }
}
