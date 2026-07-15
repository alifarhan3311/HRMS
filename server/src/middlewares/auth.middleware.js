/**
 * middlewares/auth.middleware.js
 * -----------------------------------------------------------------------
 * Authentication & authorization guards for all protected routes.
 *
 * Covers:
 *   1. authenticate       - verifies the access-token JWT from an HttpOnly
 *                            cookie, attaches req.user, handles expiry with
 *                            a clear 401 so the client can trigger a
 *                            refresh flow.
 *   2. authorize(...roles)- RBAC guard; only allows listed roles through.
 *   3. enforceTenantScope - IDOR guard; verifies the resource a request is
 *                            targeting belongs to the same company/branch
 *                            as the authenticated user, so User A can never
 *                            read/write User B's data by guessing an ID
 *                            across tenant boundaries.
 *
 * Cookies are expected to be set as:
 *   accessToken:  HttpOnly, Secure, SameSite=Strict, short-lived (~15 min)
 *   refreshToken: HttpOnly, Secure, SameSite=Strict, longer-lived, path
 *                 scoped to /api/auth/refresh only
 * -----------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const createHttpError = require('http-errors');
const logger = require('../utils/logger');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must both be set before the server starts.'
  );
}

/**
 * Role hierarchy used for "at least this level" checks in features like
 * leave-approval chains (Team Lead -> HR -> Director). Higher number =
 * more privilege. Pure equality-based checks should use authorize() below
 * instead of this ranking.
 */
const ROLE_RANK = Object.freeze({
  employee: 1,
  team_lead: 2,
  manager: 3,
  hr: 4,
  finance: 4,
  admin: 5,
  super_admin: 6,
});

/**
 * Extracts and verifies the access token from the request's HttpOnly
 * cookie, attaching the decoded payload to req.user for downstream
 * handlers. Never trusts an Authorization header for browser sessions —
 * cookies only, to keep the token out of JS-accessible storage.
 */
function authenticate(req, res, next) {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw createHttpError(401, 'Authentication required. No access token provided.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        // Distinct code lets the frontend axios interceptor distinguish
        // "please silently refresh" from "please log in again".
        throw createHttpError(401, 'Access token expired.', { code: 'ACCESS_TOKEN_EXPIRED' });
      }
      throw createHttpError(401, 'Invalid access token.');
    }

    // Shape persisted in the JWT payload at sign-time (see auth service).
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      companyId: decoded.companyId,
      branchId: decoded.branchId,
      tokenVersion: decoded.tokenVersion, // used to invalidate all sessions on password change
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * RBAC guard factory. Usage: router.get('/payroll', authenticate, authorize('finance','admin','super_admin'), handler)
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(createHttpError(401, 'Authentication required before authorization check.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('[auth] Forbidden role attempted access', {
        userId: req.user.id,
        role: req.user.role,
        allowedRoles,
        path: req.originalUrl,
      });
      return next(createHttpError(403, 'You do not have permission to perform this action.'));
    }

    next();
  };
}

/**
 * Minimum-rank guard for hierarchical approval flows, e.g. only Team Lead
 * rank or above may approve a leave request at the first stage.
 */
function requireMinimumRank(minimumRole) {
  const minimumRank = ROLE_RANK[minimumRole];
  if (!minimumRank) {
    throw new Error(`requireMinimumRank: unknown role "${minimumRole}"`);
  }

  return function minimumRankMiddleware(req, res, next) {
    const userRank = ROLE_RANK[req.user?.role];
    if (!userRank || userRank < minimumRank) {
      return next(createHttpError(403, 'Insufficient privilege level for this action.'));
    }
    next();
  };
}

/**
 * IDOR / multi-tenant isolation guard.
 *
 * Many HRMS resources (employee records, payroll entries, attendance logs)
 * are scoped to a company and/or branch. This guard compares the tenant
 * identifiers embedded in the authenticated user's token against the
 * tenant identifiers of the target resource, loaded by `resourceLoader`.
 *
 * `resourceLoader` is an async function (req) => { companyId, branchId }
 * that the route wires up per-resource (e.g. fetch the employee by
 * req.params.id and return its companyId/branchId). This middleware does
 * not know about Mongoose models directly, keeping it reusable across
 * every module without a circular dependency on database/.
 *
 * super_admin bypasses tenant scoping by design (cross-company oversight).
 */
function enforceTenantScope(resourceLoader) {
  return async function tenantScopeMiddleware(req, res, next) {
    try {
      if (req.user.role === 'super_admin') return next();

      const resourceTenant = await resourceLoader(req);

      if (!resourceTenant) {
        return next(createHttpError(404, 'Resource not found.'));
      }

      const sameCompany = String(resourceTenant.companyId) === String(req.user.companyId);
      const sameBranch = resourceTenant.branchId
        ? String(resourceTenant.branchId) === String(req.user.branchId)
        : true;

      if (!sameCompany || !sameBranch) {
        logger.warn('[auth] Cross-tenant access attempt blocked (potential IDOR)', {
          userId: req.user.id,
          userCompany: req.user.companyId,
          userBranch: req.user.branchId,
          resourceCompany: resourceTenant.companyId,
          resourceBranch: resourceTenant.branchId,
          path: req.originalUrl,
        });
        // 404 rather than 403 — do not confirm the resource exists at all
        // to a requester outside its tenant boundary.
        return next(createHttpError(404, 'Resource not found.'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  authenticate,
  authorize,
  requireMinimumRank,
  enforceTenantScope,
  ROLE_RANK,
};
