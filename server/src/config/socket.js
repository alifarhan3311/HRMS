/**
 * config/socket.js
 * Socket.io server setup for live features: real-time attendance punches,
 * live notification delivery, HR dashboard activity stream.
 * Attached to the HTTP server in server.js.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.CORS_ALLOWED_ORIGINS || '').split(','),
      credentials: true,
    },
  });

  // Auth handshake: verify the same access-token cookie used by REST auth
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const match = cookieHeader.match(/accessToken=([^;]+)/);
      if (!match) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(match[1], process.env.JWT_ACCESS_SECRET);
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

    socket.on('disconnect', () => {
      logger.info('[socket] Client disconnected', { userId: socket.user.id });
    });
  });

  return io;
}

module.exports = { initSocket };
