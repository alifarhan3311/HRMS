/**
 * modules/projects/projects.service.js
 * Business logic layer for Project. Controllers call this; this calls the
 * repository. Domain rules specific to projects (approval chains, late-policy
 * math, payroll calculations, etc.) get filled in here in the next pass.
 */
const createHttpError = require('http-errors');
const repository = require('./projects.repository');

async function createProject(payload, actor) {
  const data = { ...payload, companyId: actor.companyId, branchId: actor.branchId };
  return repository.create(data);
}

async function getProjectById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Project not found.');
  return record;
}

async function listProjects(query, actor) {
  const filter = { companyId: actor.companyId };
  return repository.findAll({
    filter,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function updateProject(id, payload) {
  const updated = await repository.updateById(id, payload);
  if (!updated) throw createHttpError(404, 'Project not found.');
  return updated;
}

async function deleteProject(id) {
  const deleted = await repository.deleteById(id);
  if (!deleted) throw createHttpError(404, 'Project not found.');
  return deleted;
}

module.exports = { createProject, getProjectById, listProjects, updateProject, deleteProject };
