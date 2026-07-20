/**
 * modules/projects/projects.service.js
 * Business logic layer for Project. Controllers call this; this calls the
 * repository. Domain rules specific to projects (approval chains, late-policy
 * math, payroll calculations, etc.) get filled in here in the next pass.
 */
const createHttpError = require('http-errors');
const repository = require('./projects.repository');
const Employee = require('../employees/employees.model');

const MANAGE_ROLES = ['super_admin', 'admin', 'manager'];

function canAccessProject(project, actor) {
  if (['super_admin', 'admin'].includes(actor.role)) return true;
  const actorId = String(actor.id);
  return [project.createdBy, project.projectManagerId, project.teamLeadId]
    .filter(Boolean).some((value) => String(value?._id || value) === actorId)
    || (project.teamMembers || []).some((member) => String(member.employeeId?._id || member.employeeId) === actorId);
}

async function eligibleEmployeeFilter(actor) {
  const base = { companyId: actor.companyId, status: 'active' };
  if (['super_admin', 'admin'].includes(actor.role)) return base;
  if (actor.role === 'manager') {
    const leads = await Employee.find({ ...base, role: 'team_lead', managerId: actor.id }).distinct('_id');
    return { ...base, $or: [{ _id: actor.id }, { managerId: actor.id }, { teamLeadId: { $in: leads } }] };
  }
  if (actor.role === 'team_lead') return { ...base, $or: [{ _id: actor.id }, { teamLeadId: actor.id }] };
  return { ...base, _id: actor.id };
}

async function validateAssignments(payload, actor) {
  const ids = [payload.projectManagerId, payload.teamLeadId, ...(payload.teamMembers || []).map((m) => m.employeeId)]
    .filter(Boolean).map(String);
  if (!ids.length) return;
  const eligible = await Employee.find({ ...(await eligibleEmployeeFilter(actor)), _id: { $in: [...new Set(ids)] } })
    .select('_id role');
  if (eligible.length !== new Set(ids).size) throw createHttpError(422, 'One or more selected project members are outside your team or company.');
  const roles = new Map(eligible.map((employee) => [String(employee._id), employee.role]));
  if (payload.projectManagerId && roles.get(String(payload.projectManagerId)) !== 'manager') {
    throw createHttpError(422, 'Project Manager must have the Manager role.');
  }
  if (payload.teamLeadId && roles.get(String(payload.teamLeadId)) !== 'team_lead') {
    throw createHttpError(422, 'Project Team Lead must have the Team Lead role.');
  }
}

async function listEligibleEmployees(actor) {
  return Employee.find(await eligibleEmployeeFilter(actor))
    .select('fullName employeeCode department designation role profilePicture managerId teamLeadId')
    .sort({ role: 1, fullName: 1 });
}

async function createProject(payload, actor) {
  if (!MANAGE_ROLES.includes(actor.role)) throw createHttpError(403, 'You cannot create projects.');
  payload = { ...payload, projectManagerId: payload.projectManagerId || null, teamLeadId: payload.teamLeadId || null };
  await validateAssignments(payload, actor);
  const data = { ...payload, companyId: actor.companyId, branchId: actor.branchId, createdBy: actor.id };
  return repository.create(data);
}

async function getProjectById(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Project not found.');
  if (!canAccessProject(record, actor)) throw createHttpError(403, 'You are not assigned to this project.');
  return record;
}

async function listProjects(query, actor) {
  const filter = { companyId: actor.companyId };
  if (!['super_admin', 'admin'].includes(actor.role)) {
    filter.$or = [
      { createdBy: actor.id },
      { projectManagerId: actor.id },
      { teamLeadId: actor.id },
      { 'teamMembers.employeeId': actor.id },
    ];
  }
  return repository.findAll({
    filter,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function updateProject(id, payload, actor) {
  if (!MANAGE_ROLES.includes(actor.role)) throw createHttpError(403, 'You cannot update projects.');
  const existing = await repository.findById(id);
  if (!existing) throw createHttpError(404, 'Project not found.');
  if (!canAccessProject(existing, actor)) throw createHttpError(403, 'You cannot update a project outside your team.');
  payload = { ...payload, projectManagerId: payload.projectManagerId || null, teamLeadId: payload.teamLeadId || null };
  await validateAssignments(payload, actor);
  const updated = await repository.updateById(id, payload);
  if (!updated) throw createHttpError(404, 'Project not found.');
  return updated;
}

async function deleteProject(id, actor) {
  if (!['super_admin', 'admin'].includes(actor.role)) throw createHttpError(403, 'Only Admin can delete projects.');
  const deleted = await repository.deleteById(id);
  if (!deleted) throw createHttpError(404, 'Project not found.');
  return deleted;
}

module.exports = {
  createProject, getProjectById, listProjects, updateProject, deleteProject, listEligibleEmployees,
};
