/**
 * server.js
 * Process entrypoint: wires the Express app, MongoDB connection, and
 * Socket.io server together, and handles graceful shutdown.
 */
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./database/db');
const { initSocket } = require('./config/socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDatabase();

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  app.set('io', io); // controllers can emit via req.app.get('io')

  httpServer.listen(PORT, () => {
    logger.info(`[server] HRMS API listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    logger.info(`[server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[server] Fatal startup error', { error: err.message });
  process.exit(1);
});
