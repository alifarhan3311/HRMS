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
const isProduction = process.env.NODE_ENV === 'production';
const isReadOnlyRuntime = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV
);

// Serverless and container platforms commonly expose a read-only application
// filesystem. Their log collectors read stdout/stderr, so file transports are
// useful locally but must not be created in production.
const transports = [new winston.transports.Console()];

if (!isProduction && !isReadOnlyRuntime) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction ? prodFormat : devFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
