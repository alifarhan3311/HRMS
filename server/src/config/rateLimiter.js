/**
 * config/rateLimiter.js
 * Redis-backed rate limiters so limits are enforced consistently across
 * multiple app instances behind a load balancer, not just per-process.
 */
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('./redis');

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message } },
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
  });
}

// Tighter limiter on auth routes — protects against credential stuffing/brute force
const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again later.',
});

// Baseline limiter for the rest of the API
const apiRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down.',
});

module.exports = { authRateLimiter, apiRateLimiter };
