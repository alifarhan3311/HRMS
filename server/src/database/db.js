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
mongoose.set('bufferCommands', false);

const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 1000; // 1s, doubles each attempt, capped below
const MAX_RETRY_DELAY_MS = 30000; // 30s ceiling

let retryAttempt = 0;
let isShuttingDown = false;
let connectionPromise = null;
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV
);

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
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGO_URI (or MONGODB_URI) is not defined in environment configuration.');
  }

  const options = {
    autoIndex: process.env.NODE_ENV !== 'production', // skip index builds in prod
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || (isServerless ? 10 : 50),
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || (isServerless ? 0 : 5),
    serverSelectionTimeoutMS: isServerless ? 5000 : 10000,
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
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const maxAttempts = isServerless ? 1 : MAX_RETRY_ATTEMPTS;

    while (retryAttempt < maxAttempts && !isShuttingDown) {
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
          maxAttempts,
          nextRetryInMs: delay,
          error: err.message,
        });

        if (retryAttempt >= maxAttempts) {
          throw new Error(
            `[database] Exhausted ${maxAttempts} connection attempts: ${err.message}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    // A warm serverless instance must be able to retry on a later request
    // after a transient Atlas/network configuration problem is corrected.
    connectionPromise = null;
    retryAttempt = 0;
    throw error;
  }
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
