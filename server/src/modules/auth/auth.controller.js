/**
 * modules/auth/auth.controller.js
 * Thin HTTP layer — parses req, calls service, shapes response. No
 * business logic lives here.
 */
const service = require('./auth.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const create = asyncHandler(async (req, res) => {
  const record = await service.createSession(req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

const getById = asyncHandler(async (req, res) => {
  const record = await service.getSessionById(req.params.id);
  res.status(200).json({ success: true, data: record });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listSessions(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const update = asyncHandler(async (req, res) => {
  const record = await service.updateSession(req.params.id, req.body);
  res.status(200).json({ success: true, data: record });
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteSession(req.params.id);
  res.status(204).send();
});

module.exports = { create, getById, list, update, remove };
