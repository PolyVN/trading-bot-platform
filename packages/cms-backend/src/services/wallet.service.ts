import crypto from 'node:crypto';
import type { AuthUser } from '../middleware/auth.js';
import { buildExchangeFilter, checkExchangeAccess, mongoFilter } from '../middleware/auth.js';
import { Wallet } from '../models/Wallet.js';
import { Bot } from '../models/Bot.js';
import { auditQueue } from '../workers/index.js';
import { config } from '../config.js';
import { buildSortObject, buildPaginatedResponse } from '../validation/common.js';
import { NotFoundError, ConflictError } from '../lib/route-utils.js';

interface WalletListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  exchange?: string;
  isActive?: boolean;
}

/**
 * Encrypt credentials with AES-256-GCM.
 * Returns a string in the format `iv:authTag:ciphertext` (all hex-encoded).
 */
function encryptCredentials(creds: Record<string, string>): string {
  const keyBuffer = Buffer.from(config.encryption.key, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const plaintext = JSON.stringify(creds);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export class WalletService {
  static async list(query: WalletListQuery, user: AuthUser) {
    const {
      page = 1,
      limit = 50,
      sort,
      order = 'desc',
      exchange,
      isActive,
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

    if (isActive !== undefined) queryFilter.isActive = isActive;

    const sortObj = buildSortObject(sort, order);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Wallet.find(mongoFilter(queryFilter))
        .select('-credentials')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Wallet.countDocuments(mongoFilter(queryFilter)),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  static async getById(walletId: string, user: AuthUser) {
    const wallet = await Wallet.findOne(mongoFilter({ walletId })).lean();
    if (!wallet) throw new NotFoundError('Wallet not found');

    checkExchangeAccess(user, wallet.exchange);

    // Strip credential values — return only the credential keys so the frontend
    // knows which fields exist without exposing secrets.
    const { credentials, ...rest } = wallet;
    const credentialKeys = WalletService.extractCredentialKeys(credentials);

    return { ...rest, credentialKeys };
  }

  static async create(data: Record<string, unknown>, user: AuthUser) {
    const walletId = crypto.randomUUID();
    const exchange = data.exchange as string;

    checkExchangeAccess(user, exchange);

    const rawCredentials = data.credentials as Record<string, string>;

    // Encrypt credentials before storage
    const encryptedCredentials = encryptCredentials(rawCredentials);

    const wallet = await Wallet.create({
      ...data,
      walletId,
      credentials: encryptedCredentials,
      createdBy: user.sub,
    });

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'wallet.create',
      exchange,
      entityType: 'wallet',
      entityId: walletId,
      details: { name: data.name, exchange },
      timestamp: new Date(),
    });

    // Return without the raw credentials
    const result = wallet.toJSON() as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credentials: _, ...safe } = result;
    return { ...safe, credentialKeys: Object.keys(rawCredentials) };
  }

  static async delete(walletId: string, user: AuthUser) {
    const wallet = await Wallet.findOne(mongoFilter({ walletId })).lean() as
      | { walletId: string; name: string; exchange: string; assignedBotIds: string[] }
      | null;
    if (!wallet) throw new NotFoundError('Wallet not found');

    checkExchangeAccess(user, wallet.exchange);

    // Check no bots are using this wallet
    if (wallet.assignedBotIds && wallet.assignedBotIds.length > 0) {
      throw new ConflictError(
        `Cannot delete wallet: ${wallet.assignedBotIds.length} bot(s) are still using it. ` +
        `Reassign or delete those bots first.`,
      );
    }

    // Double-check via Bot collection in case assignedBotIds is stale
    const botCount = await Bot.countDocuments(mongoFilter({ walletId }));
    if (botCount > 0) {
      throw new ConflictError(
        `Cannot delete wallet: ${botCount} bot(s) reference this wallet. ` +
        `Reassign or delete those bots first.`,
      );
    }

    await Wallet.deleteOne(mongoFilter({ walletId }));

    await auditQueue.add('audit', {
      auditId: crypto.randomUUID(),
      userId: user.sub,
      action: 'wallet.delete',
      exchange: wallet.exchange,
      entityType: 'wallet',
      entityId: walletId,
      details: { name: wallet.name },
      timestamp: new Date(),
    });
  }

  /**
   * Extract credential keys from stored credentials.
   * Handles both encrypted string format and legacy object format.
   */
  private static extractCredentialKeys(credentials: unknown): string[] {
    if (typeof credentials === 'string') {
      // Encrypted format — we cannot extract keys from the ciphertext.
      // Return a generic indicator based on common exchange credential patterns.
      return ['[encrypted]'];
    }
    if (credentials && typeof credentials === 'object') {
      return Object.keys(credentials as Record<string, unknown>);
    }
    return [];
  }

}
