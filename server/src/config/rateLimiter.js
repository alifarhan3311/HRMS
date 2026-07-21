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

function buildLimiter({ windowMs, max, message, prefix }) {
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
        // Every limiter needs its own Redis namespace. Without this,
        // express-rate-limit sees the auth and API limiters incrementing the
        // same key for one /auth request and raises ERR_ERL_DOUBLE_COUNT.
        prefix,
      });
      options.store = store;
    } catch (err) {
      logger.warn('[rateLimiter] Could not init RedisStore, falling back to memory', { err: err.message });
    }
  }

  return rateLimit(options);
}

const authRateLimiter = buildLimiter({
  prefix: 'hrms:rate-limit:auth:v2:',
  windowMs: 15 * 60 * 1000,
  max: Math.max(10, Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '50', 10) || 50),
  message: 'Too many authentication attempts. Please try again later.',
});

const apiRateLimiter = buildLimiter({
  prefix: 'hrms:rate-limit:api:v2:',
  windowMs: 15 * 60 * 1000,
  // Dashboard widgets, notification polling and normal route navigation can
  // legitimately create several hundred calls in a working session.
  max: Math.max(300, Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1200', 10) || 1200),
  message: 'Too many requests. Please slow down.',
});

module.exports = { authRateLimiter, apiRateLimiter };
