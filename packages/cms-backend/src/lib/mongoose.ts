import mongoose from 'mongoose';
import { config } from '../config.js';
import { logger } from './logger.js';

export async function connectMongoDB(): Promise<typeof mongoose> {
  const conn = await mongoose.connect(config.mongodb.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err: err.message }, '[MongoDB] Connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[MongoDB] Disconnected');
  });

  return conn;
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
