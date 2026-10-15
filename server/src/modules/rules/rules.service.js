const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const Rule = require('./rules.model');
const Employee = require('../employees/employees.model');
const employeeService = require('../employees/employees.service');
const { validatePayload } = require('./rules.validation');

function scope(actor) {
  if (!actor?.companyId) throw createHttpError(403, 'Company access is required.');
  return { companyId: actor.companyId, deletedAt: null };
}
function requireHR(actor) {
  if (actor?.role !== 'hr') throw createHttpError(403, 'Only HR can manage rules and regulations.');
}
function target(id, actor) {
  if (!mongoose.isObjectIdOrHexString(id)) throw createHttpError(400, 'Invalid rule ID.');
  return { ...scope(actor), _id: id };
}
async function list(actor) {
  const base = scope(actor);
  // HR maintains and sees every company rule. Everyone else gets company-wide
  // rules plus rules specifically published for their own department.
  if (actor.role === 'hr') return Rule.find(base).sort({ createdAt: -1, _id: -1 }).lean();
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId })
    .select('department').lean();
  const department = String(employee?.department || '').trim().toLowerCase();
  return Rule.find({
    ...base,
    $or: [
      { audience: 'all' },
      { audience: { $exists: false } }, // Rules created before audience targeting are company-wide.
      ...(department ? [{ audience: 'department', department }] : []),
    ],
  }).sort({ createdAt: -1, _id: -1 }).lean();
}
async function validateAudience(data, actor) {
  if (data.audience !== 'department') return data;
  const departments = await employeeService.getDepartmentList(actor.companyId);
  if (!departments.includes(data.department)) {
    throw createHttpError(422, 'Select a valid department for this regulation.');
  }
  return data;
}
async function create(payload, actor) {
  requireHR(actor);
  const data = await validateAudience(validatePayload(payload, 'create'), actor);
  return Rule.create({ ...data, ...scope(actor), createdBy: actor.id, updatedBy: actor.id });
}
async function change(id, payload, actor, remove = false) {
  requireHR(actor);
  const { revision, ...data } = validatePayload(payload, remove ? 'delete' : 'update');
  if (!remove) await validateAudience(data, actor);
  const filter = target(id, actor);
  const record = await Rule.findOneAndUpdate({ ...filter, revision }, {
    $set: { ...(remove ? { deletedAt: new Date() } : data), updatedBy: actor.id },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await Rule.exists(filter)) throw createHttpError(404, 'Rule not found.');
    throw createHttpError(409, 'This rule has changed. Close the editor and reopen the latest version.');
  }
  return record;
}
module.exports = { list, create, change };
