/**
 * config/redis.js
 * Shared ioredis client used by rate limiting and BullMQ queues, so the
 * whole app reuses one connection pool instead of each feature opening
 * its own socket to Redis.
 */
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ's blocking connections
  enableReadyCheck: true,
});

redisClient.on('connect', () => logger.info('[redis] Connected'));
redisClient.on('error', (err) => logger.error('[redis] Connection error', { error: err.message }));

module.exports = redisClient;
