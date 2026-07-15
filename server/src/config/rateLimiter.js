/**
 * config/rateLimiter.js
 * Rate limiters — uses Redis when available, falls back to in-memory
 * (MemoryStore) when Redis is not reachable (dev / test environments).
 * This prevents the server from refusing to start when Redis is offline.
 */
const rateLimit = require('express-rate-limit');
const logger    = require('../utils/logger');

let RedisStore;
let redisClient;
const useRedisStore = process.env.NODE_ENV === 'production'
  || process.env.REDIS_RATE_LIMIT_ENABLED === 'true';

// Attempt to load Redis-backed store; gracefully degrade if unavailable
if (useRedisStore) {
  try {
    ({ RedisStore } = require('rate-limit-redis'));
    redisClient = require('./redis');
  } catch (err) {
    logger.warn('[rateLimiter] rate-limit-redis not available, using in-memory store', { err: err.message });
  }
}

function buildLimiter({ windowMs, max, message }) {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    message: { success: false, error: { message } },
    // Skip storing in Redis if client isn't connected
    skip: () => false,
  };

  if (RedisStore && redisClient) {
    try {
      // Adapt ioredis to the rate-limit-redis v4 command interface.
      const store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
      });
      options.store = store;
    } catch (err) {
      logger.warn('[rateLimiter] Could not init RedisStore, falling back to memory', { err: err.message });
    }
  }

  return rateLimit(options);
}

const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again later.',
});

const apiRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down.',
});

module.exports = { authRateLimiter, apiRateLimiter };
