const Employee = require('./employees.model');

function normalizeDepartments(values = []) {
  return [...new Set(values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

function exactDepartmentPattern(department) {
  const escaped = String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

async function getManagedDepartments(actor) {
  if (actor.role !== 'manager') return [];
  if (Array.isArray(actor.managedDepartments)) {
    return normalizeDepartments(actor.managedDepartments);
  }
  const manager = await Employee.findOne({
    _id: actor.id,
    companyId: actor.companyId,
    role: 'manager',
    status: 'active',
  }).select('managedDepartments').lean();
  return normalizeDepartments(manager?.managedDepartments || []);
}

async function buildManagerEmployeeScope(actor) {
  const managedDepartments = await getManagedDepartments(actor);
  const scope = [{ managerId: actor.id }];
  if (managedDepartments.length) {
    scope.push({ department: { $in: managedDepartments.map(exactDepartmentPattern) } });
  }
  return { $or: scope };
}

async function managerCanAccessEmployee(actor, employee) {
  if (String(employee.managerId?._id || employee.managerId || '') === String(actor.id)) return true;
  const managedDepartments = await getManagedDepartments(actor);
  return managedDepartments.includes(String(employee.department || '').trim().toLowerCase());
}

module.exports = {
  normalizeDepartments,
  getManagedDepartments,
  buildManagerEmployeeScope,
  managerCanAccessEmployee,
};
