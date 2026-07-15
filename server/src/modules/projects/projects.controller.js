/**
 * modules/projects/projects.controller.js
 * Thin HTTP layer — parses req, calls service, shapes response. No
 * business logic lives here.
 */
const service = require('./projects.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const create = asyncHandler(async (req, res) => {
  const record = await service.createProject(req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

const getById = asyncHandler(async (req, res) => {
  const record = await service.getProjectById(req.params.id);
  res.status(200).json({ success: true, data: record });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listProjects(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const update = asyncHandler(async (req, res) => {
  const record = await service.updateProject(req.params.id, req.body);
  res.status(200).json({ success: true, data: record });
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteProject(req.params.id);
  res.status(204).send();
});

module.exports = { create, getById, list, update, remove };
