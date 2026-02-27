const env = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  host: env('HOST', '0.0.0.0'),
  nodeEnv: env('NODE_ENV', 'development'),
  isDev: env('NODE_ENV', 'development') === 'development',

  mongodb: {
    uri: env('MONGODB_URI', 'mongodb://root:password@localhost:27017/trading?authSource=admin'),
  },

  redis: {
    url: env('REDIS_URL', 'redis://:password@localhost:6379'),
  },

  jwt: {
    secret: env('JWT_SECRET', 'dev-secret-change-me'),
    accessExpiresIn: env('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  encryption: {
    key: env('ENCRYPTION_KEY', '0000000000000000000000000000000000000000000000000000000000000000'),
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
    password: env('ADMIN_PASSWORD', 'changeme'),
  },
} as const;
