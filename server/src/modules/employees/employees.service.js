/**
 * modules/employees/employees.service.js
 * Business logic for Employee management. All domain rules live here;
 * controllers call this and repository methods handle DB I/O.
 */
const bcrypt = require('bcrypt');
const createHttpError = require('http-errors');
const repository = require('./employees.repository');
const Session = require('../auth/auth.model');
const Shift = require('../shifts/shifts.model');
const settingsService = require('../companySettings/companySettings.service');

const PASSWORD_SALT_ROUNDS = 12;
const LEAVE_BALANCE_TYPES = ['paid', 'casual', 'sick', 'annual'];
const MANAGEABLE_ROLES = {
  super_admin: ['admin', 'hr', 'manager', 'team_lead', 'employee'],
  hr: ['manager', 'team_lead', 'employee'],
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function generateEmployeeIdentifiers(companyId) {
  const sequence = await repository.nextSequence(companyId);
  const companyTag = String(companyId).slice(-4).toUpperCase();
  const number = String(sequence).padStart(6, '0');
  return {
    employeeCode: `EMP-${companyTag}-${number}`,
    employeeCardNumber: `CARD-${companyTag}-${number}`,
  };
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

function normalizeOptionalReferences(payload) {
  const normalized = { ...payload };
  for (const field of ['managerId', 'teamLeadId', 'shiftId']) {
    if (normalized[field] === '') normalized[field] = null;
  }
  return normalized;
}

async function validateAssignedShift(shiftId, companyId) {
  if (!shiftId) return;
  const exists = await Shift.exists({ _id: shiftId, companyId, isActive: true });
  if (!exists) throw createHttpError(422, 'Selected shift is invalid or inactive.');
}

async function validateReportingLine({ managerId, teamLeadId }, companyId, employeeId = null) {
  if (employeeId && [managerId, teamLeadId].filter(Boolean).some((id) => String(id) === String(employeeId))) {
    throw createHttpError(422, 'An employee cannot report to themselves.');
  }
  const [manager, teamLead] = await Promise.all([
    managerId ? repository.findById(managerId) : null,
    teamLeadId ? repository.findById(teamLeadId) : null,
  ]);
  if (managerId && (!manager || String(manager.companyId) !== String(companyId) || manager.role !== 'manager' || manager.status !== 'active')) {
    throw createHttpError(422, 'Selected Reporting Manager is invalid or inactive.');
  }
  if (teamLeadId && (!teamLead || String(teamLead.companyId) !== String(companyId) || teamLead.role !== 'team_lead' || teamLead.status !== 'active')) {
    throw createHttpError(422, 'Selected Team Lead is invalid or inactive.');
  }
  if (manager && teamLead?.managerId && String(teamLead.managerId?._id || teamLead.managerId) !== String(manager._id)) {
    throw createHttpError(422, 'Selected Team Lead belongs to a different Manager.');
  }
}

async function applyDepartmentReportingLine(payload, companyId, role, employeeId = null) {
  const department = String(payload.department || '').trim();
  if (role === 'manager') {
    payload.managerId = null;
    payload.teamLeadId = null;
    if (!department) return;
    const duplicate = await repository.findActiveDepartmentManager(companyId, department, employeeId);
    if (duplicate) {
      throw createHttpError(409, `${department} already has an active Manager: ${duplicate.fullName}.`);
    }
    return;
  }
  if (!['team_lead', 'employee'].includes(role) || !department) return;
  const departmentManager = await repository.findActiveDepartmentManager(companyId, department);
  if (departmentManager) payload.managerId = departmentManager._id;

  if (role === 'team_lead') {
    payload.teamLeadId = null;
    const duplicate = await repository.findActiveDepartmentTeamLead(companyId, department, employeeId);
    if (duplicate) {
      throw createHttpError(409, `${department} already has an active Team Lead: ${duplicate.fullName}.`);
    }
    return;
  }

  const departmentTeamLead = await repository.findActiveDepartmentTeamLead(companyId, department);
  if (departmentTeamLead) payload.teamLeadId = departmentTeamLead._id;
}

function assertCanManageEmployee(actor, target, { allowSelf = false, action = 'manage' } = {}) {
  const isSelf = String(actor.id) === String(target._id);
  if (isSelf) {
    if (allowSelf) return;
    throw createHttpError(400, `You cannot ${action} your own account.`);
  }

  const manageableRoles = MANAGEABLE_ROLES[actor.role] || [];
  if (!manageableRoles.includes(target.role)) {
    if (target.role === 'super_admin') {
      throw createHttpError(403, 'Super Admin accounts are protected and cannot be managed or deactivated.');
    }
    throw createHttpError(403, `Your role cannot ${action} this account.`);
  }
}

function assertCanAssignRole(actor, role) {
  const manageableRoles = MANAGEABLE_ROLES[actor.role] || [];
  if (!manageableRoles.includes(role)) {
    throw createHttpError(403, `Your role cannot create or assign the ${role} role.`);
  }
}

function teamLeaderCanView(actor, employee) {
  if (!['manager', 'team_lead'].includes(actor.role)) return true;
  const actorId = String(actor.id);
  if (String(employee._id) === actorId) return true;
  const reportingField = actor.role === 'manager' ? employee.managerId : employee.teamLeadId;
  return String(reportingField?._id || reportingField || '') === actorId;
}

function redactManagerPrivateFields(employee) {
  const visible = { ...employee };
  for (const field of [
    'cnic', 'currentSalary', 'salaryHistory', 'insuranceCardNumber',
    'fatherName', 'dateOfBirth', 'maritalStatus', 'address', 'emergencyContact',
  ]) delete visible[field];
  return visible;
}

function balanceFromPolicy(entitlements, existingBalance = {}, carriedForward = {}) {
  return Object.fromEntries(LEAVE_BALANCE_TYPES.map((type) => [type, {
    available: Number(entitlements?.[type] || 0) + Number(carriedForward?.[type] || 0),
    used: Number(existingBalance?.[type]?.used || 0),
  }]));
}

function validCarriedForward(employee) {
  const joiningYear = employee.joiningDate ? new Date(employee.joiningDate).getFullYear() : Infinity;
  const processedYear = Number(employee.leaveCycle?.lastProcessedYear || 0);
  return employee.leaveCycle?.basis === 'calendar_year' && processedYear > joiningYear
    ? (employee.leaveCycle?.carriedForward || {})
    : {};
}

function visibleLeaveBalance(balance, enabledTypes = LEAVE_BALANCE_TYPES, entitlements = {}, carriedForward = {}) {
  return Object.fromEntries(Object.entries(balance || {})
    .filter(([type]) => enabledTypes.includes(type))
    .map(([type, values]) => {
      const entitlement = Number(entitlements?.[type] || 0);
      const carried = Number(carriedForward?.[type] || 0);
      return [type, {
        ...values,
        available: entitlement + carried,
        entitlement,
        carriedForward: carried,
      }];
    }));
}

async function reconcileLeaveBalance(employee) {
  const settings = await settingsService.getPolicy(employee.companyId);
  const expected = balanceFromPolicy(
    settings.leavePolicy?.entitlements,
    employee.leaveBalance,
    validCarriedForward(employee)
  );
  const needsUpdate = LEAVE_BALANCE_TYPES.some((type) => (
    Number(employee.leaveBalance?.[type]?.available || 0) !== expected[type].available
  ));

  if (needsUpdate) {
    employee.leaveBalance = expected;
    await employee.save();
  }
  return {
    employee,
    enabledTypes: settings.leavePolicy?.enabledTypes || LEAVE_BALANCE_TYPES,
    entitlements: settings.leavePolicy?.entitlements || {},
  };
}

// -------------------------------------------------------------------------
// Core CRUD
// -------------------------------------------------------------------------

async function createEmployee(payload, actor) {
  payload = normalizeOptionalReferences(payload);
  assertCanAssignRole(actor, payload.role);
  await applyDepartmentReportingLine(payload, actor.companyId, payload.role);
  // Validate uniqueness
  const existing = await repository.findByEmail(payload.email, actor.companyId);
  if (existing) throw createHttpError(409, 'An employee with this email already exists.');

  if (payload.cnic) {
    const cnicExists = await repository.findByCnic(payload.cnic, actor.companyId);
    if (cnicExists) throw createHttpError(409, 'An employee with this CNIC already exists.');
  }

  await validateAssignedShift(payload.shiftId, actor.companyId);
  await validateReportingLine(payload, actor.companyId);

  // Both identifiers come from one atomic company sequence, so concurrent
  // employee creation cannot issue duplicate codes or card numbers.
  const identifiers = await generateEmployeeIdentifiers(actor.companyId);

  // Hash the initial password
  const passwordHash = await bcrypt.hash(payload.password, PASSWORD_SALT_ROUNDS);
  const settings = await settingsService.getPolicy(actor.companyId);
  const currentYear = new Date().getFullYear();

  const data = {
    ...payload,
    ...identifiers,
    passwordHash,
    leaveBalance: balanceFromPolicy(settings.leavePolicy?.entitlements),
    leaveCycle: {
      basis: 'calendar_year',
      lastProcessedYear: currentYear,
      lastProcessedAt: new Date(),
      nextResetDate: new Date(Date.UTC(currentYear + 1, 0, 1)),
      carriedForward: {},
    },
    companyId: actor.companyId,
    branchId: actor.branchId,
  };
  delete data.password; // never store plaintext

  const employee = await repository.create(data);
  if (employee.role === 'manager' && employee.department) {
    await repository.assignDepartmentManager(actor.companyId, employee.department, employee._id);
  }
  if (employee.role === 'team_lead' && employee.department) {
    await repository.assignDepartmentTeamLead(actor.companyId, employee.department, employee._id);
  }
  return sanitize(employee);
}

async function getEmployeeById(id, actor) {
  let record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Employee not found.');
  if (!teamLeaderCanView(actor, record)) {
    throw createHttpError(403, 'You can only view employees assigned to your team.');
  }
  const reconciled = await reconcileLeaveBalance(record);
  record = reconciled.employee;
  const obj = record.toObject({ getters: true });
  obj.enabledLeaveTypes = reconciled.enabledTypes;
  obj.leaveBalance = visibleLeaveBalance(
    obj.leaveBalance,
    reconciled.enabledTypes,
    reconciled.entitlements,
    validCarriedForward(record)
  );
  obj.tenure = obj.joiningDate ? calcTenure(obj.joiningDate) : null;
  return ['manager', 'team_lead'].includes(actor.role) && String(actor.id) !== String(obj._id)
    ? redactManagerPrivateFields(obj)
    : obj;
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

  if (['manager', 'team_lead'].includes(actor.role)) {
    await Promise.all([
      repository.syncDepartmentManagers(actor.companyId),
      repository.syncDepartmentTeamLeads(actor.companyId),
    ]);
  }

  const filter = { companyId: actor.companyId };

  // Managers see only their direct department team. Department automation
  // assigns both Team Leads and Employees to managerId, so this includes the
  // complete team without exposing another manager's staff.
  if (actor.role === 'manager') filter.managerId = actor.id;
  if (actor.role === 'team_lead') filter.teamLeadId = actor.id;

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

  const [result, settings] = await Promise.all([
    repository.findAll({
      filter,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      sort,
    }),
    settingsService.getPolicy(actor.companyId),
  ]);
  const enabledTypes = settings.leavePolicy?.enabledTypes || LEAVE_BALANCE_TYPES;

  result.items = result.items.map((e) => {
    const obj = e.toObject ? e.toObject({ getters: true }) : e;
    const carriedForward = validCarriedForward(obj);
    const item = {
      ...obj,
      enabledLeaveTypes: enabledTypes,
      leaveBalance: visibleLeaveBalance(
        obj.leaveBalance,
        enabledTypes,
        settings.leavePolicy?.entitlements,
        carriedForward
      ),
      tenure: obj.joiningDate ? calcTenure(obj.joiningDate) : null,
    };
    return ['manager', 'team_lead'].includes(actor.role) ? redactManagerPrivateFields(item) : item;
  });

  return result;
}

async function updateEmployee(id, payload, actor) {
  payload = normalizeOptionalReferences(payload);
  const existing = await repository.findById(id);
  if (!existing) throw createHttpError(404, 'Employee not found.');
  assertCanManageEmployee(actor, existing, { allowSelf: true, action: 'edit' });
  const effectiveDepartment = payload.department !== undefined ? payload.department : existing.department;
  payload.department = effectiveDepartment;
  await applyDepartmentReportingLine(payload, actor.companyId, existing.role, id);

  // If email is being changed, check uniqueness
  if (payload.email && payload.email !== existing.email) {
    const emailTaken = await repository.findByEmail(payload.email, existing.companyId);
    if (emailTaken && String(emailTaken._id) !== id) {
      throw createHttpError(409, 'Email is already in use by another employee.');
    }
  }

  await validateAssignedShift(payload.shiftId, actor.companyId);
  await validateReportingLine(payload, actor.companyId, id);

  // Never allow these fields via general update
  const forbidden = ['passwordHash', 'password', 'companyId', 'role', 'employeeCode', 'employeeCardNumber'];
  forbidden.forEach((f) => delete payload[f]);

  const updated = await repository.updateById(id, payload);
  if (!updated) throw createHttpError(404, 'Employee not found.');
  if (existing.role === 'manager') {
    if (String(existing.department || '').toLowerCase() !== String(updated.department || '').toLowerCase()) {
      await repository.clearManagerReferences(id);
    }
    if (updated.department && updated.status === 'active') {
      await repository.assignDepartmentManager(actor.companyId, updated.department, updated._id);
    }
  }
  if (existing.role === 'team_lead') {
    if (String(existing.department || '').toLowerCase() !== String(updated.department || '').toLowerCase()) {
      await repository.clearTeamLeadReferences(id);
    }
    if (updated.department && updated.status === 'active') {
      await repository.assignDepartmentTeamLead(actor.companyId, updated.department, updated._id);
    }
  }
  return sanitize(updated);
}

async function deleteEmployee(id, actor) {
  const existing = await repository.findById(id);
  if (!existing) throw createHttpError(404, 'Employee not found.');
  assertCanManageEmployee(actor, existing, { action: 'permanently delete' });

  // Preserve historical business records, but remove live account/session and
  // reporting-line references so no employee points at a deleted account.
  await Promise.all([
    Session.deleteMany({ employeeId: id }),
    repository.clearReportingReferences(id),
  ]);

  const deleted = await repository.deleteById(id);
  if (!deleted) throw createHttpError(404, 'Employee not found.');
  return { message: 'Employee permanently deleted.' };
}

async function getEmployeeHierarchy(actor) {
  await Promise.all([
    repository.syncDepartmentManagers(actor.companyId),
    repository.syncDepartmentTeamLeads(actor.companyId),
  ]);
  const filter = { companyId: actor.companyId };
  if (actor.role === 'manager') {
    filter.$or = [{ _id: actor.id }, { managerId: actor.id }];
  } else if (actor.role === 'team_lead') {
    filter.$or = [{ _id: actor.id }, { teamLeadId: actor.id }];
  }
  return repository.getHierarchy(filter);
}

// -------------------------------------------------------------------------
// Status Management
// -------------------------------------------------------------------------

async function changeStatus(id, { status, reason }, actor) {
  const employee = await repository.findById(id);
  if (!employee) throw createHttpError(404, 'Employee not found.');
  assertCanManageEmployee(actor, employee, { action: status === 'active' ? 'activate' : 'deactivate' });

  const update = { status };
  if (status === 'resigned') {
    update.exitDate = new Date();
    update.exitReason = reason || '';
  }

  if (employee.role === 'manager' && status === 'active' && employee.department) {
    const duplicate = await repository.findActiveDepartmentManager(employee.companyId, employee.department, employee._id);
    if (duplicate) throw createHttpError(409, `${employee.department} already has an active Manager: ${duplicate.fullName}.`);
  }
  if (employee.role === 'team_lead' && status === 'active' && employee.department) {
    const duplicate = await repository.findActiveDepartmentTeamLead(employee.companyId, employee.department, employee._id);
    if (duplicate) throw createHttpError(409, `${employee.department} already has an active Team Lead: ${duplicate.fullName}.`);
  }

  const updated = await repository.updateById(id, update);
  if (employee.role === 'manager') {
    if (status === 'active' && employee.department) {
      await repository.assignDepartmentManager(employee.companyId, employee.department, employee._id);
    } else {
      await repository.clearManagerReferences(employee._id);
    }
  }
  if (employee.role === 'team_lead') {
    if (status === 'active' && employee.department) {
      await repository.assignDepartmentTeamLead(employee.companyId, employee.department, employee._id);
    } else {
      await repository.clearTeamLeadReferences(employee._id);
    }
  }
  return sanitize(updated);
}

// -------------------------------------------------------------------------
// Promotion / Transfer
// -------------------------------------------------------------------------

async function promoteEmployee(id, promotionData, actor) {
  const employee = await repository.findById(id);
  if (!employee) throw createHttpError(404, 'Employee not found.');
  assertCanManageEmployee(actor, employee, { action: 'promote' });
  if (promotionData.role) assertCanAssignRole(actor, promotionData.role);
  const nextRole = promotionData.role || employee.role;
  const nextDepartment = promotionData.department || employee.department;
  const automaticAssignment = { department: nextDepartment };
  await applyDepartmentReportingLine(automaticAssignment, employee.companyId, nextRole, employee._id);

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
  if (nextRole === 'manager') {
    update.$set.managerId = null;
    update.$set.teamLeadId = null;
  } else if (automaticAssignment.managerId) {
    update.$set.managerId = automaticAssignment.managerId;
  }
  if (nextRole === 'team_lead') {
    update.$set.teamLeadId = null;
  } else if (automaticAssignment.teamLeadId) {
    update.$set.teamLeadId = automaticAssignment.teamLeadId;
  }
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
  if (employee.role === 'manager' && (nextRole !== 'manager' || String(employee.department || '').toLowerCase() !== String(nextDepartment || '').toLowerCase())) {
    await repository.clearManagerReferences(employee._id);
  }
  if (employee.role === 'team_lead' && (nextRole !== 'team_lead' || String(employee.department || '').toLowerCase() !== String(nextDepartment || '').toLowerCase())) {
    await repository.clearTeamLeadReferences(employee._id);
  }
  if (nextRole === 'manager' && nextDepartment) {
    await repository.assignDepartmentManager(employee.companyId, nextDepartment, employee._id);
  }
  if (nextRole === 'team_lead' && nextDepartment) {
    await repository.assignDepartmentTeamLead(employee.companyId, nextDepartment, employee._id);
  }
  return sanitize(updated);
}

// -------------------------------------------------------------------------
// Department Statistics (for dashboards, filters)
// -------------------------------------------------------------------------

async function getDepartmentList(companyId) {
  return repository.getDistinctDepartments(companyId);
}

async function getEmployeeStats(actor) {
  if (['manager', 'team_lead'].includes(actor.role)) {
    await Promise.all([
      repository.syncDepartmentManagers(actor.companyId),
      repository.syncDepartmentTeamLeads(actor.companyId),
    ]);
  }
  const filter = { companyId: actor.companyId };
  if (actor.role === 'manager') filter.managerId = actor.id;
  if (actor.role === 'team_lead') filter.teamLeadId = actor.id;
  return repository.getStats(filter);
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
  getEmployeeHierarchy,
  updateEmployee,
  deleteEmployee,
  changeStatus,
  promoteEmployee,
  getDepartmentList,
  getEmployeeStats,
};
