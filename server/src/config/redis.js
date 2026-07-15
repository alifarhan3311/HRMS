/**
 * config/redis.js
 * Shared ioredis client. Configured with lazyConnect + retryStrategy so
 * the app starts cleanly even when Redis is offline (dev/test with no Redis).
 * Features that require Redis (rate limiting, queues) degrade gracefully.
 */
const Redis  = require('ioredis');
const logger = require('../utils/logger');

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,    // don't block startup on Redis readiness
  lazyConnect: true,          // don't auto-connect on require()
  retryStrategy(times) {
    // Exponential backoff, cap at 30s, stop after 10 attempts in production
    if (process.env.NODE_ENV === 'production' && times > 10) return null; // stop retrying
    return Math.min(times * 500, 30000);
  },
});

redisClient.on('connect', () => logger.info('[redis] Connected'));
redisClient.on('ready',   () => logger.info('[redis] Ready'));
redisClient.on('error',   (err) => logger.warn('[redis] Connection error (non-fatal in dev)', { error: err.message }));
redisClient.on('close',   () => logger.warn('[redis] Connection closed'));

// Attempt connection — errors are swallowed so the server still starts
redisClient.connect().catch(err => {
  logger.warn('[redis] Initial connection failed (non-fatal)', { error: err.message });
});

module.exports = redisClient;
