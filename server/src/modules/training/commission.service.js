const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const TrainingCommission = require('./commission.model');
const Employee = require('../employees/employees.model');
const { validateCommission } = require('./commission.validation');

const DEFAULT_COMMISSIONS = [
  ['ATM', 5000, 'PKR'],
  ['POS', 15000, 'PKR'],
  ['Accounting', 15000, 'PKR'],
  ['Digital Media', 10, 'percent'],
  ['Insurance', 10000, 'PKR'],
  ['Loan Services', 10000, 'PKR'],
  ['Easy Finance', 5000, 'PKR'],
];

function requireHr(actor) {
  if (actor?.role !== 'hr') throw createHttpError(403, 'Only HR can manage commissions.');
  if (!actor.companyId) throw createHttpError(403, 'Company access is required.');
}
async function requireCommissionReader(actor) {
  if (!actor?.companyId) throw createHttpError(403, 'Company access is required.');
  if (actor.role === 'hr') return;
  if (!['employee', 'team_lead', 'floor_head', 'manager'].includes(actor.role)) {
    throw createHttpError(403, 'Commission values are available only to Call Center employees and HR.');
  }
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId }).select('department').lean();
  const department = String(employee?.department || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!['callcenter', 'callcentre'].includes(department)) {
    throw createHttpError(403, 'Commission values are available only to Call Center employees and HR.');
  }
}
function target(id, actor) {
  if (!mongoose.isObjectIdOrHexString(id)) throw createHttpError(400, 'Invalid commission ID.');
  return { _id: id, companyId: actor.companyId, deletedAt: null };
}

async function list(actor) {
  await requireCommissionReader(actor);
  for (const [name, amount, unit] of DEFAULT_COMMISSIONS) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (await TrainingCommission.exists({ companyId: actor.companyId, slug })) continue;
    try {
      await TrainingCommission.findOneAndUpdate(
        { companyId: actor.companyId, slug, deletedAt: null },
        { $setOnInsert: { companyId: actor.companyId, name, slug, amount, unit, createdBy: actor.id, updatedBy: actor.id } },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
    } catch (error) {
      // A concurrent HR request may win the same unique insert.
      if (error.code !== 11000) throw error;
    }
  }
  return TrainingCommission.find({ companyId: actor.companyId, deletedAt: null }).sort({ name: 1, _id: 1 }).lean();
}

async function create(payload, actor) {
  requireHr(actor);
  const data = validateCommission(payload, 'create');
  if (await TrainingCommission.exists({ companyId: actor.companyId, slug: data.slug, deletedAt: null })) {
    throw createHttpError(409, 'A commission with this name already exists.');
  }
  return TrainingCommission.create({ ...data, companyId: actor.companyId, createdBy: actor.id, updatedBy: actor.id });
}

async function update(id, payload, actor) {
  requireHr(actor);
  const { revision, ...data } = validateCommission(payload, 'update');
  if (await TrainingCommission.exists({ companyId: actor.companyId, slug: data.slug, _id: { $ne: id }, deletedAt: null })) {
    throw createHttpError(409, 'A commission with this name already exists.');
  }
  const record = await TrainingCommission.findOneAndUpdate({ ...target(id, actor), revision }, {
    $set: { ...data, updatedBy: actor.id }, $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await TrainingCommission.exists(target(id, actor))) throw createHttpError(404, 'Commission not found.');
    throw createHttpError(409, 'This commission changed. Reload the latest version before saving.');
  }
  return record;
}

async function remove(id, payload, actor) {
  requireHr(actor);
  const { revision } = validateCommission(payload, 'delete');
  const record = await TrainingCommission.findOneAndUpdate({ ...target(id, actor), revision }, {
    $set: { deletedAt: new Date(), updatedBy: actor.id }, $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await TrainingCommission.exists(target(id, actor))) throw createHttpError(404, 'Commission not found.');
    throw createHttpError(409, 'This commission changed. Reload the latest version before saving.');
  }
}

module.exports = { list, create, update, remove };
