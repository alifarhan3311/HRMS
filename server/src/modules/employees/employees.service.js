/**
 * modules/employees/employees.service.js
 * Business logic for Employee management. All domain rules live here;
 * controllers call this and repository methods handle DB I/O.
 */
const bcrypt = require('bcrypt');
const createHttpError = require('http-errors');
const repository = require('./employees.repository');

const PASSWORD_SALT_ROUNDS = 12;

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Auto-generate employee code if not supplied, based on department prefix.
 */
async function generateEmployeeCode(department, companyId) {
  const prefix = (department || 'EMP').replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const count = await repository.countByCompany(companyId);
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/**
 * Calculate company tenure in Years / Months / Days.
 */
function calcTenure(joiningDate) {
  const now = new Date();
  const joined = new Date(joiningDate);
  const ms = now - joined;
  const totalDays = Math.floor(ms / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  return { years, months, days };
}

// -------------------------------------------------------------------------
// Core CRUD
// -------------------------------------------------------------------------

async function createEmployee(payload, actor) {
  // Validate uniqueness
  const existing = await repository.findByEmail(payload.email, actor.companyId);
  if (existing) throw createHttpError(409, 'An employee with this email already exists.');

  if (payload.cnic) {
    const cnicExists = await repository.findByCnic(payload.cnic, actor.companyId);
    if (cnicExists) throw createHttpError(409, 'An employee with this CNIC already exists.');
  }

  // Auto-generate employee code if not provided
  const employeeCode = payload.employeeCode || await generateEmployeeCode(payload.department, actor.companyId);

  // Hash the initial password
  const passwordHash = await bcrypt.hash(payload.password, PASSWORD_SALT_ROUNDS);

  const data = {
    ...payload,
    employeeCode,
    passwordHash,
    companyId: actor.companyId,
    branchId: actor.branchId,
  };
  delete data.password; // never store plaintext

  const employee = await repository.create(data);
  return sanitize(employee);
}

async function getEmployeeById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Employee not found.');
  const obj = record.toObject({ getters: true });
  obj.tenure = obj.joiningDate ? calcTenure(obj.joiningDate) : null;
  return obj;
}

async function listEmployees(query, actor) {
  const {
    page = 1,
    limit = 20,
    search,
    department,
    status,
    role,
    sort = '-createdAt',
  } = query;

  const filter = { companyId: actor.companyId };

  if (status) filter.status = status;
  if (department) filter.department = new RegExp(department, 'i');
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { fullName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { employeeCode: new RegExp(search, 'i') },
      { designation: new RegExp(search, 'i') },
    ];
  }

  const result = await repository.findAll({
    filter,
    page: Number(page),
    limit: Math.min(Number(limit), 100),
    sort,
  });

  result.items = result.items.map((e) => {
    const obj = e.toObject ? e.toObject({ getters: true }) : e;
    return { ...obj, tenure: obj.joiningDate ? calcTenure(obj.joiningDate) : null };
  });

  return result;
}

async function updateEmployee(id, payload, actor) {
  const existing = await repository.findById(id);
  if (!existing) throw createHttpError(404, 'Employee not found.');

  // If email is being changed, check uniqueness
  if (payload.email && payload.email !== existing.email) {
    const emailTaken = await repository.findByEmail(payload.email, existing.companyId);
    if (emailTaken && String(emailTaken._id) !== id) {
      throw createHttpError(409, 'Email is already in use by another employee.');
    }
  }

  // Never allow these fields via general update
  const forbidden = ['passwordHash', 'password', 'companyId', 'role', 'employeeCode'];
  forbidden.forEach((f) => delete payload[f]);

  const updated = await repository.updateById(id, payload);
  if (!updated) throw createHttpError(404, 'Employee not found.');
  return sanitize(updated);
}

async function deleteEmployee(id) {
  // Soft-delete: set status to resigned rather than hard delete
  const updated = await repository.updateById(id, { status: 'inactive' });
  if (!updated) throw createHttpError(404, 'Employee not found.');
  return { message: 'Employee deactivated.' };
}

// -------------------------------------------------------------------------
// Status Management
// -------------------------------------------------------------------------

async function changeStatus(id, { status, reason }, actor) {
  const employee = await repository.findById(id);
  if (!employee) throw createHttpError(404, 'Employee not found.');

  const update = { status };
  if (status === 'resigned') {
    update.exitDate = new Date();
    update.exitReason = reason || '';
  }

  const updated = await repository.updateById(id, update);
  return sanitize(updated);
}

// -------------------------------------------------------------------------
// Promotion / Transfer
// -------------------------------------------------------------------------

async function promoteEmployee(id, promotionData, actor) {
  const employee = await repository.findById(id);
  if (!employee) throw createHttpError(404, 'Employee not found.');

  const historyEntry = {
    designation: employee.designation,
    department: employee.department,
    role: employee.role,
    currentSalary: employee.currentSalary,
    incrementAmount: promotionData.incrementAmount || 0,
    effectiveDate: new Date(promotionData.effectiveDate),
    remarks: promotionData.remarks || '',
    changedBy: actor.id,
    changedAt: new Date(),
  };

  const update = {
    $push: { promotionHistory: historyEntry },
    $set: {},
  };

  if (promotionData.designation) update.$set.designation = promotionData.designation;
  if (promotionData.department) update.$set.department = promotionData.department;
  if (promotionData.role) update.$set.role = promotionData.role;
  if (promotionData.currentSalary) {
    update.$set.currentSalary = promotionData.currentSalary;
    update.$set.lastIncrementAmount = promotionData.incrementAmount || 0;
    update.$set.lastIncrementDate = new Date(promotionData.effectiveDate);
    // Append to salary history
    const newSalaryEntry = {
      salary: promotionData.currentSalary,
      effectiveDate: new Date(promotionData.effectiveDate),
      incrementAmount: promotionData.incrementAmount || 0,
      changedBy: actor.id,
    };
    update.$push.salaryHistory = newSalaryEntry;
  }

  const updated = await repository.updateRaw(id, update);
  if (!updated) throw createHttpError(404, 'Employee not found.');
  return sanitize(updated);
}

// -------------------------------------------------------------------------
// Department Statistics (for dashboards, filters)
// -------------------------------------------------------------------------

async function getDepartmentList(companyId) {
  return repository.getDistinctDepartments(companyId);
}

async function getEmployeeStats(companyId) {
  return repository.getStats(companyId);
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/** Strip passwordHash from any returned object. */
function sanitize(employee) {
  const obj = employee.toObject ? employee.toObject({ getters: true }) : { ...employee };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

module.exports = {
  createEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  changeStatus,
  promoteEmployee,
  getDepartmentList,
  getEmployeeStats,
};
