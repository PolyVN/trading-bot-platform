import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { User } from '../models/User.js';
import { config } from '../config.js';

/**
 * Seeds an admin user on first run if no users exist.
 */
export async function seedAdminUser(log: FastifyBaseLogger): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;

  const passwordHash = await bcrypt.hash(config.admin.password, 12);

  await User.create({
    userId: crypto.randomUUID(),
    email: config.admin.email.toLowerCase(),
    passwordHash,
    role: 'admin',
    allowedExchanges: [],
    isActive: true,
  });

  log.info(`[Seed] Admin user created: ${config.admin.email}`);
}
