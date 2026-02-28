import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { EXCHANGES } from '../constants.js';
import { logger } from './logger.js';

let io: SocketIOServer | null = null;

export function setupSocketIO(app: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(app.server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authenticate WebSocket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = app.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Room management on connection
  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.debug({ socketId: socket.id, userId: user?.sub }, '[Socket.IO] Client connected');

    // Everyone joins the global room
    socket.join('global');

    // Join exchange-specific rooms based on user's allowed exchanges
    const allowedExchanges = user?.allowedExchanges as string[] | undefined;
    if (allowedExchanges && allowedExchanges.length > 0) {
      for (const exchange of allowedExchanges) {
        socket.join(`exchange:${exchange}`);
      }
    } else {
      // Admins (or users with no exchange restrictions) join all exchange rooms
      for (const ex of EXCHANGES) {
        socket.join(`exchange:${ex}`);
      }
    }

    // Allow clients to subscribe/unsubscribe to bot-specific rooms dynamically
    socket.on('subscribe:bot', (botId: string) => {
      if (typeof botId === 'string' && botId.length > 0) {
        socket.join(`bot:${botId}`);
        logger.debug({ socketId: socket.id, botId }, '[Socket.IO] Joined bot room');
      }
    });

    socket.on('unsubscribe:bot', (botId: string) => {
      if (typeof botId === 'string' && botId.length > 0) {
        socket.leave(`bot:${botId}`);
        logger.debug({ socketId: socket.id, botId }, '[Socket.IO] Left bot room');
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, '[Socket.IO] Client disconnected');
    });
  });

  app.log.info('[Socket.IO] Server attached with JWT auth and room management');

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
