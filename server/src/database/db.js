/**
 * database/db.js
 * -----------------------------------------------------------------------
 * Centralized MongoDB connection manager built on Mongoose.
 *
 * Responsibilities:
 *  - Establish and maintain a single MongoDB connection for the app lifecycle
 *  - Automatically attempt reconnection with exponential backoff if the
 *    connection drops (network blip, replica-set failover, etc.)
 *  - Emit structured logs for every connection lifecycle event so ops teams
 *    can trace availability issues from the audit/monitoring stack
 *  - Expose a graceful shutdown hook so server.js can close the connection
 *    cleanly on SIGTERM/SIGINT without leaving dangling sockets
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Mongoose 7+ ships sane defaults, but we set these explicitly so behavior
// is documented and doesn't silently change on a dependency bump.
mongoose.set('strictQuery', true);

const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 1000; // 1s, doubles each attempt, capped below
const MAX_RETRY_DELAY_MS = 30000; // 30s ceiling

let retryAttempt = 0;
let isShuttingDown = false;
let connectionPromise = null;

/**
 * Computes exponential backoff delay with jitter to avoid thundering-herd
 * reconnection storms if multiple instances restart at once.
 */
function getBackoffDelay(attempt) {
  const exponential = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * 0.3 * exponential; // up to 30% jitter
  return Math.round(exponential + jitter);
}

/**
 * Attempts a single connection to MongoDB using the URI and options
 * supplied via environment configuration.
 */
async function attemptConnection() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment configuration.');
  }

  const options = {
    autoIndex: process.env.NODE_ENV !== 'production', // skip index builds in prod
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, // force IPv4 to avoid slow DNS dual-stack lookups
  };

  await mongoose.connect(uri, options);
}

/**
 * Public entrypoint. Call once during server bootstrap (server.js).
 * Resolves once connected; rejects only after all retry attempts are
 * exhausted so the process can fail fast in genuinely broken environments.
 */
async function connectDatabase() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    while (retryAttempt < MAX_RETRY_ATTEMPTS && !isShuttingDown) {
      try {
        await attemptConnection();
        retryAttempt = 0; // reset counter after a clean connect
        logger.info('[database] MongoDB connected successfully', {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
        });
        return mongoose.connection;
      } catch (err) {
        retryAttempt += 1;
        const delay = getBackoffDelay(retryAttempt);
        logger.error('[database] Connection attempt failed', {
          attempt: retryAttempt,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          nextRetryInMs: delay,
          error: err.message,
        });

        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          throw new Error(
            `[database] Exhausted ${MAX_RETRY_ATTEMPTS} connection attempts: ${err.message}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  })();

  return connectionPromise;
}

/**
 * Lifecycle event wiring. These fire automatically for the underlying
 * driver's connection state changes, independent of our manual retry loop
 * above (which only covers the *initial* connect).
 */
mongoose.connection.on('connected', () => {
  logger.info('[database] Mongoose connection established');
});

mongoose.connection.on('disconnected', () => {
  if (isShuttingDown) return;
  logger.warn('[database] Mongoose connection lost — driver will attempt to reconnect');
});

mongoose.connection.on('reconnected', () => {
  logger.info('[database] Mongoose connection restored');
});

mongoose.connection.on('error', (err) => {
  logger.error('[database] Mongoose connection error', { error: err.message });
});

/**
 * Graceful shutdown — call from server.js on SIGTERM/SIGINT so open
 * cursors/sockets are released before the process exits.
 */
async function disconnectDatabase() {
  isShuttingDown = true;
  try {
    await mongoose.connection.close(false);
    logger.info('[database] MongoDB connection closed gracefully');
  } catch (err) {
    logger.error('[database] Error during graceful shutdown', { error: err.message });
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  connection: mongoose.connection,
};
