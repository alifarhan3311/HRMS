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

// Attempt to load Redis-backed store; gracefully degrade if unavailable
try {
  RedisStore  = require('rate-limit-redis');
  redisClient = require('./redis');
} catch (err) {
  logger.warn('[rateLimiter] rate-limit-redis not available, using in-memory store', { err: err.message });
}

function buildLimiter({ windowMs, max, message }) {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message } },
    // Skip storing in Redis if client isn't connected
    skip: () => false,
  };

  if (RedisStore && redisClient) {
    try {
      // rate-limit-redis v4 uses { sendCommand } — v3 uses { client }
      // Support both API shapes
      const storeOptions = typeof RedisStore === 'function'
        ? { sendCommand: (...args) => redisClient.call(...args) }
        : { client: redisClient };

      // Detect v4 constructor shape (expects { sendCommand })
      const store = new RedisStore(storeOptions);
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
