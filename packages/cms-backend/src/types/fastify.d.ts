import type { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      role: 'admin' | 'operator' | 'viewer';
      allowedExchanges: string[];
    };
    user: {
      sub: string;
      email: string;
      role: 'admin' | 'operator' | 'viewer';
      allowedExchanges: string[];
    };
  }
}
