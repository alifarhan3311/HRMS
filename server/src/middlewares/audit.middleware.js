const AuditLog = require('../modules/auditLogs/auditLogs.model');
const logger = require('../utils/logger');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'accessToken', 'refreshToken',
  'token', 'secret', 'smtpPass', 'encryptionMasterKey',
]);

function sanitize(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitize(item, depth + 1),
  ]));
}

function inferResourceType(path) {
  return path.replace(/^\/api\/v1\//, '').split('/')[0] || 'unknown';
}

function auditMutations(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    const context = req.auditContext || {};
    const userId = context.userId || req.user?.id;
    const companyId = context.companyId || req.user?.companyId;
    const resourceType = context.resourceType || inferResourceType(req.originalUrl);

    AuditLog.create({
      userId,
      companyId,
      action: context.action || `${req.method.toLowerCase()}.${resourceType}`,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'],
      resourceType,
      resourceId: context.resourceId || req.params?.id,
      changes: sanitize(req.body || {}),
    }).catch((error) => {
      logger.error('[audit] Failed to persist audit log', { error: error.message });
    });
  });

  return next();
}

module.exports = auditMutations;
