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

  app.log.info('[Socket.IO] Server attached');

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
