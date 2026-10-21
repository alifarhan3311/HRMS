const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const TrainingCategory = require('./training.model');
const Employee = require('../employees/employees.model');
const employeeService = require('../employees/employees.service');
const { validatePayload } = require('./training.validation');

const MANAGERS = ['hr', 'admin', 'super_admin'];
const STARTER_CATEGORIES = [
  ['atm', 'ATM', 'ATM services, transaction handling, and customer support.'],
  ['pos', 'POS', 'Point-of-sale operations, settlements, and troubleshooting.'],
  ['accounting', 'Accounting', 'Accounting workflows, records, and quality standards.'],
  ['mortgage', 'Mortgage', 'Mortgage process knowledge, documentation, and customer care.'],
  ['digital-media', 'Digital Media', 'Digital channels, content workflows, and campaign basics.'],
  ['insurance', 'Insurance', 'Insurance products, customer guidance, and process compliance.'],
  ['business-loans', 'Business Loans', 'Business lending products, application flow, and documentation.'],
  ['easy-finance', 'Easy Finance', 'Easy Finance products, customer eligibility, and service workflow.'],
  ['call-center', 'Call Center', 'Call handling, service quality, and customer communication.', 'department'],
];

function requireCompany(actor) {
  if (!actor?.companyId) throw createHttpError(403, 'Company access is required.');
}
function requireManager(actor) {
  if (!MANAGERS.includes(actor?.role)) throw createHttpError(403, 'Only HR or an administrator can manage training categories.');
}
function normalizeDepartment(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}
function scope(actor) {
  requireCompany(actor);
  return { companyId: actor.companyId, deletedAt: null };
}
function target(id, actor) {
  if (!mongoose.isObjectIdOrHexString(id)) throw createHttpError(400, 'Invalid training category ID.');
  return { ...scope(actor), _id: id };
}

async function seedStarterCategories(actor) {
  if (await TrainingCategory.exists({ companyId: actor.companyId })) return;
  const departments = await employeeService.getDepartmentList(actor.companyId);
  const callCenterDepartment = departments.find(name => normalizeDepartment(name) === 'callcenter') || 'call center';
  const records = STARTER_CATEGORIES.map(([slug, name, summary, audience]) => ({
    companyId: actor.companyId,
    name,
    slug,
    summary,
    audience: audience || 'all',
    departments: audience ? [callCenterDepartment.toLowerCase()] : [],
    blocks: [
      { type: 'paragraph', text: summary },
      { type: 'heading', text: 'Training details' },
      { type: 'paragraph', text: 'HR can edit this page to add the training material, process steps, and learning resources.' },
    ],
    createdBy: actor.id,
    updatedBy: actor.id,
  }));
  try {
    await TrainingCategory.insertMany(records, { ordered: false });
  } catch (error) {
    // A concurrent first visit can race the starter-category initialization.
    if (error.code !== 11000 && !error.writeErrors?.every(item => item.code === 11000)) throw error;
  }
}

async function list(actor) {
  const base = scope(actor);
  await seedStarterCategories(actor);
  const categories = await TrainingCategory.find(base).sort({ name: 1, _id: 1 }).lean();
  if (MANAGERS.includes(actor.role)) return categories;
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId }).select('department').lean();
  const department = normalizeDepartment(employee?.department);
  return categories.filter(category => category.audience === 'all'
    || category.departments.some(name => normalizeDepartment(name) === department));
}

async function validateDepartments(data, actor) {
  if (data.audience !== 'department') return data;
  const valid = await employeeService.getDepartmentList(actor.companyId);
  const validNames = new Map(valid.map(name => [normalizeDepartment(name), name.toLowerCase()]));
  const normalized = data.departments.map(normalizeDepartment);
  if (!normalized.length || normalized.some(name => !validNames.has(name))) {
    throw createHttpError(422, 'Select one or more valid departments for this training.');
  }
  data.departments = [...new Set(normalized.map(name => validNames.get(name)))];
  return data;
}

async function create(payload, actor) {
  requireManager(actor);
  const data = await validateDepartments(validatePayload(payload, 'create'), actor);
  if (await TrainingCategory.exists({ companyId: actor.companyId, slug: data.slug, deletedAt: null })) {
    throw createHttpError(409, 'A training tab with this name already exists.');
  }
  return TrainingCategory.create({ ...data, ...scope(actor), createdBy: actor.id, updatedBy: actor.id });
}

async function change(id, payload, actor, remove = false) {
  requireManager(actor);
  const { revision, ...validated } = validatePayload(payload, remove ? 'delete' : 'update');
  const filter = { ...target(id, actor), revision };
  let data = validated;
  if (!remove) {
    data = await validateDepartments(data, actor);
    if (await TrainingCategory.exists({ ...scope(actor), slug: data.slug, _id: { $ne: id } })) {
      throw createHttpError(409, 'A training tab with this name already exists.');
    }
  }
  const record = await TrainingCategory.findOneAndUpdate(filter, {
    $set: { ...(remove ? { deletedAt: new Date() } : data), updatedBy: actor.id },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await TrainingCategory.exists(target(id, actor))) throw createHttpError(404, 'Training category not found.');
    throw createHttpError(409, 'This training page changed. Reopen the latest version before saving.');
  }
  return record;
}

module.exports = { list, create, change };
