/**
 * modules/auth/auth.service.js
 * Business logic layer for Session. Controllers call this; this calls the
 * repository. Domain rules specific to auth (approval chains, late-policy
 * math, payroll calculations, etc.) get filled in here in the next pass.
 */
const createHttpError = require('http-errors');
const repository = require('./auth.repository');

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
  const filter = { companyId: actor.companyId };
  return repository.findAll({
    filter,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
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

module.exports = { createSession, getSessionById, listSessions, updateSession, deleteSession };
