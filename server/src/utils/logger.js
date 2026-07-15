/**
 * utils/logger.js
 * -----------------------------------------------------------------------
 * Thin wrapper around Winston used across the server (connection events,
 * request/audit logs, error handlers). Kept as a small supporting file
 * since db.js, app.js, and auth.middleware.js all depend on it.
 *
 * In production, transport can be extended to ship logs to a centralized
 * store (ELK, CloudWatch, etc.) without touching call sites.
 * -----------------------------------------------------------------------
 */

const winston = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  exitOnError: false,
});

module.exports = logger;
