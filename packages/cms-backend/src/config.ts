const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

const env = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Require an env var in production, allow a dev-only fallback otherwise.
 */
const envRequired = (key: string, devFallback: string): string => {
  const value = process.env[key];
  if (value) return value;
  if (isDev) return devFallback;
  throw new Error(`Missing required environment variable: ${key} (no default in production)`);
};

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  host: env('HOST', '0.0.0.0'),
  nodeEnv: env('NODE_ENV', 'development'),
  isDev,

  mongodb: {
    uri: env('MONGODB_URI', 'mongodb://root:password@localhost:27017/trading?authSource=admin'),
  },

  redis: {
    url: env('REDIS_URL', 'redis://:password@localhost:6379'),
  },

  jwt: {
    secret: envRequired('JWT_SECRET', 'dev-secret-do-not-use-in-production'),
    accessExpiresIn: env('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  encryption: {
    key: envRequired('ENCRYPTION_KEY', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
  },

  cors: {
    origin: env('CORS_ORIGIN', 'http://localhost:3000'),
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  },

  admin: {
    email: env('ADMIN_EMAIL', 'admin@polyvn.com'),
    password: envRequired('ADMIN_PASSWORD', 'changeme'),
  },
} as const;
