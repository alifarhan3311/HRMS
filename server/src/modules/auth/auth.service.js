/**
 * modules/auth/auth.service.js
 * Business logic layer for Session. Controllers call this; this calls the
 * repository. Domain rules specific to auth (approval chains, late-policy
 * math, payroll calculations, etc.) get filled in here in the next pass.
 */
const createHttpError = require('http-errors');
const mongoose = require('mongoose');
const repository = require('./auth.repository');
const { emitToSession } = require('../../config/socket');
const { lookupApproximateLocation } = require('./loginAlert');

function requireSessionAccess(actor) {
  if (!actor?.id || !actor.companyId || !['hr', 'admin'].includes(actor.role)) {
    throw createHttpError(403, 'Only HR and Admin can manage their own device sessions.');
  }
}

async function createSession(payload, actor) {
  const data = { ...payload, companyId: actor.companyId, branchId: actor.branchId };
  return repository.create(data);
}

async function getSessionById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Session not found.');
  return record;
}

async function listSessions(query, actor) {
  requireSessionAccess(actor);
  const filter = {
    employeeId: actor.id,
    revoked: false,
    expiresAt: { $gt: new Date() },
    $or: [
      { companyId: actor.companyId },
      // Legacy sessions are still restricted to this authenticated account.
      { companyId: { $exists: false } },
    ],
  };
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const result = await repository.findAll({
    filter,
    page,
    limit,
  });

  // Resolve only a small number of unique public IPs per page. This keeps
  // the third-party GeoIP provider from receiving an unbounded burst of
  // requests when a company has many active sessions.
  const uniqueIps = [...new Set(result.items.map(item => item.ipAddress).filter(Boolean))].slice(0, 10);
  const locations = new Map(await Promise.all(uniqueIps.map(async ip => [ip, await lookupApproximateLocation(ip)])));
  result.items = result.items.map(item => ({
    ...item,
    location: locations.get(item.ipAddress) || 'Unavailable (IP geolocation not looked up)',
  }));
  return result;
}

async function revokeSession(id, actor, currentSessionId) {
  requireSessionAccess(actor);
  if (!mongoose.isValidObjectId(id)) throw createHttpError(400, 'Invalid session ID.');
  if (String(id) === String(currentSessionId)) {
    throw createHttpError(400, 'You cannot sign out the device you are currently using.');
  }

  const session = await repository.findById(id);
  if (!session || session.revoked || session.expiresAt <= new Date()) {
    throw createHttpError(404, 'Active session not found.');
  }

  const ownsSession = String(session.employeeId) === String(actor.id);
  const belongsToCompany = !session.companyId || String(session.companyId) === String(actor.companyId);
  if (!ownsSession || !belongsToCompany) throw createHttpError(404, 'Active session not found.');

  const revoked = await repository.revokeActiveById(id, actor.id);
  if (!revoked) throw createHttpError(404, 'Active session not found.');
  emitToSession(id, 'session:revoked', { reason: 'remote_sign_out' });
  return { message: 'Device session signed out.' };
}

async function updateSession(id, payload) {
  const updated = await repository.updateById(id, payload);
  if (!updated) throw createHttpError(404, 'Session not found.');
  return updated;
}

async function deleteSession(id) {
  const deleted = await repository.deleteById(id);
  if (!deleted) throw createHttpError(404, 'Session not found.');
  return deleted;
}

module.exports = { createSession, getSessionById, listSessions, updateSession, deleteSession, revokeSession };
