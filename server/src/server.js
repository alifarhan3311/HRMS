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
const { startHrAutomation } = require('./jobs/hrAutomation');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function start() {
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  app.set('io', io); // controllers can emit via req.app.get('io')
  let stopHrAutomation = () => {};

  httpServer.listen(PORT, () => {
    logger.info(`[server] HRMS API listening on port ${PORT}`);
  });

  // Bind the HTTP port before waiting for external services. This keeps the
  // cloud liveness endpoint responsive during a slow/transient database
  // connection instead of exposing a platform-level 502 while booting.
  connectDatabase()
    .then(() => {
      stopHrAutomation = startHrAutomation();
    })
    .catch((err) => {
      // API requests use the cached connection gate in app.js and can retry
      // after a transient startup failure; the process itself stays healthy.
      logger.error('[server] Initial database connection failed; API requests will retry', {
        error: err.message,
      });
    });

  const shutdown = async (signal) => {
    logger.info(`[server] Received ${signal}, shutting down gracefully...`);
    stopHrAutomation();
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

start().catch((err) => {
  logger.error('[server] Fatal startup error', { error: err.message });
  process.exit(1);
});
