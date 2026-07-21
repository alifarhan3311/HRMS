/**
 * app.js
 * -----------------------------------------------------------------------
 * Express application assembly. server.js imports this configured app and
 * binds it to an HTTP(S) listener + attaches the socket.io server.
 *
 * Middleware order matters and is deliberate:
 *   1. Trust proxy (if behind nginx/ALB, for correct req.ip / rate-limit)
 *   2. helmet                - secure HTTP headers
 *   3. cors                  - strict allow-list, credentials enabled
 *   4. request body parsers  - json/urlencoded with size limits
 *   5. cookie-parser         - reads HttpOnly auth cookies
 *   6. mongo-sanitize        - strips NoSQL-injection operators from input
 *   7. hpp                   - guards against HTTP parameter pollution
 *   8. compression           - gzip responses
 *   9. request/audit logger  - structured request logging (morgan -> winston)
 *  10. rate limiters         - Redis-backed, tighter on /auth
 *  11. routes                - module routers mounted under /api/v1
 *  12. 404 handler
 *  13. global error handler
 * -----------------------------------------------------------------------
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const createHttpError = require('http-errors');

const logger = require('./utils/logger');
const { connectDatabase } = require('./database/db');
const { authRateLimiter, apiRateLimiter } = require('./config/rateLimiter');

const app = express();

// -------------------------------------------------------------------------
// Trust proxy — required for correct client IPs and secure cookies when
// running behind a reverse proxy / load balancer (nginx, ALB, Cloudflare).
// -------------------------------------------------------------------------
const configuredProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
app.set('trust proxy', Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0
  ? configuredProxyHops
  : 1);

// -------------------------------------------------------------------------
// Security headers
// -------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  })
);

// -------------------------------------------------------------------------
// CORS — explicit allow-list from env, credentials required for
// cookie-based auth to function cross-origin between client/server hosts.
// -------------------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://mhcirclesolutions.com,https://www.mhcirclesolutions.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin header, e.g. server-to-server
      // health checks) while still enforcing the allow-list for browsers.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn('[cors] Blocked request from disallowed origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
    ],
  })
);

// -------------------------------------------------------------------------
// Body parsing — explicit size limits to reduce large-payload DoS surface
// -------------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// -------------------------------------------------------------------------
// NoSQL injection sanitization — strips keys starting with '$' or
// containing '.' from req.body/query/params before they ever reach a
// Mongoose query.
// -------------------------------------------------------------------------
app.use(
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn('[security] Sanitized potentially malicious input key', {
        key,
        path: req.originalUrl,
        ip: req.ip,
      });
    },
  })
);

// HTTP Parameter Pollution guard (e.g. ?role=employee&role=admin)
app.use(hpp());

// Response compression
app.use(compression());

// -------------------------------------------------------------------------
// Request / audit logging — morgan writes structured lines into the
// winston logger rather than stdout directly, so log level & transports
// (file/ELK/etc.) stay centrally controlled.
// -------------------------------------------------------------------------
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.originalUrl === '/health', // don't spam logs with health checks
  })
);

// Persist a redacted audit record after every mutating request completes.
app.use(require('./middlewares/audit.middleware'));

// -------------------------------------------------------------------------
// Rate limiting — global baseline plus a stricter limiter specifically on
// authentication routes, both backed by Redis so limits hold across
// multiple app instances behind a load balancer.
// -------------------------------------------------------------------------
// The strict limiter protects credential/session issuance only. Applying it
// to /auth/me and /auth/socket-token caused an already authenticated user to
// be locked out simply by navigating around the application.
app.use('/api/v1/auth/login', authRateLimiter);
app.use('/api/v1/auth/refresh', authRateLimiter);
app.use('/api/v1', apiRateLimiter);

// -------------------------------------------------------------------------
// Health check (unauthenticated, used by load balancer / orchestrator)
// -------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vercel and other serverless hosts can import the Express app directly,
// bypassing server.js where the long-running process normally connects first.
// Gate API requests on a cached database connection in both deployment modes.
app.use('/api/v1', (req, res, next) => {
  connectDatabase().then(() => next()).catch(next);
});

// -------------------------------------------------------------------------
// Feature module routers.
// Each module (auth, employees, attendance, payroll, projects, ...) owns
// its own router file at modules/<name>/<name>.routes.js and is mounted
// here as it's built out in subsequent steps.
// -------------------------------------------------------------------------
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/employees', require('./modules/employees/employees.routes'));
app.use('/api/v1/attendance', require('./modules/attendance/attendance.routes'));
app.use('/api/v1/leaves', require('./modules/leaves/leaves.routes'));
app.use('/api/v1/payroll', require('./modules/payroll/payroll.routes'));
app.use('/api/v1/expenses', require('./modules/expenses/expenses.routes'));
app.use('/api/v1/projects', require('./modules/projects/projects.routes'));
app.use('/api/v1/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/holidays', require('./modules/holidays/holidays.routes'));
app.use('/api/v1/shifts', require('./modules/shifts/shifts.routes'));
app.use('/api/v1/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/v1/audit-logs', require('./modules/auditLogs/auditLogs.routes'));
app.use('/api/v1/company-settings', require('./modules/companySettings/companySettings.routes'));

// -------------------------------------------------------------------------
// 404 handler — anything not matched by a route above
// -------------------------------------------------------------------------
app.use((req, res, next) => {
  next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

// -------------------------------------------------------------------------
// Global error handler — must be registered last, with 4 args, for
// Express to recognize it as an error middleware.
// -------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  logger[isServerError ? 'error' : 'warn']('[error-handler]', {
    message: err.message,
    status,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: isServerError ? err.stack : undefined,
  });

  res.status(status).json({
    success: false,
    error: {
      message: isServerError && process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : err.message,
      code: err.code || undefined,
    },
  });
});

module.exports = app;
