/**
 * config/socket.js
 * Socket.io server setup for live features: real-time attendance punches,
 * live notification delivery, HR dashboard activity stream.
 * Attached to the HTTP server in server.js.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let socketServer = null;

function initSocket(httpServer) {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://mhcirclesolutions.com,https://www.mhcirclesolutions.com')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Auth handshake accepts the HttpOnly access cookie on same-site setups or
  // a short-lived, socket-scoped ticket for split frontend/backend domains.
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const match = cookieHeader.match(/accessToken=([^;]+)/);
      const socketToken = socket.handshake.auth?.token;
      const token = socketToken || match?.[1];
      if (!token) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      if (socketToken && decoded.scope !== 'socket') return next(new Error('Unauthorized'));
      socket.user = { id: decoded.sub, companyId: decoded.companyId, role: decoded.role };
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('[socket] Client connected', { userId: socket.user.id });

    // Scope every client to a room per company so events never cross tenants
    socket.join(`company:${socket.user.companyId}`);
    socket.join(`user:${socket.user.id}`);

    socket.emit('socket:ready', {
      userId: socket.user.id,
      connectedAt: new Date().toISOString(),
    });

    socket.on('disconnect', () => {
      logger.info('[socket] Client disconnected', { userId: socket.user.id });
    });
  });

  socketServer = io;
  return io;
}

function emitToUser(userId, event, payload) {
  if (!socketServer || !userId) return false;
  socketServer.to(`user:${userId}`).emit(event, payload);
  return true;
}

function emitToCompany(companyId, event, payload) {
  if (!socketServer || !companyId) return false;
  socketServer.to(`company:${companyId}`).emit(event, payload);
  return true;
}

module.exports = { initSocket, emitToUser, emitToCompany };
