import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

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

  app.log.info('[Socket.IO] Server attached with JWT auth');

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
