const { emitToCompany } = require('../config/socket');

const RESOURCE_TAGS = {
  employees: ['Employees', 'Auth', 'Attendance', 'Leaves', 'Payroll', 'Dashboard', 'Projects', 'Reports'],
  attendance: ['Attendance', 'Payroll', 'Dashboard', 'Reports'],
  leaves: ['Leaves', 'Employees', 'Attendance', 'Payroll', 'Dashboard', 'Reports'],
  payroll: ['Payroll', 'Dashboard', 'Reports'],
  expenses: ['Expenses', 'ExpenseCategories', 'Dashboard', 'Reports'],
  projects: ['Projects', 'Employees', 'Dashboard'],
  holidays: ['Holidays', 'Attendance', 'Payroll', 'Dashboard', 'Reports'],
  shifts: ['Shifts', 'Employees', 'Auth', 'Attendance', 'Payroll', 'Dashboard', 'Reports'],
  notifications: ['Notifications', 'Dashboard'],
  'company-settings': ['Settings', 'Employees', 'Auth', 'Attendance', 'Leaves', 'Payroll', 'Dashboard', 'Reports'],
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_SESSION_PATH = /^\/api\/v1\/auth\/(login|logout|refresh|socket-token)/;

module.exports = function realtimeSync(req, res, next) {
  if (!MUTATING_METHODS.has(req.method) || AUTH_SESSION_PATH.test(req.originalUrl)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?.companyId) return;
    const resource = req.originalUrl.split('?')[0].split('/')[3];
    const tags = RESOURCE_TAGS[resource];
    if (!tags) return;
    emitToCompany(req.user.companyId, 'data:changed', {
      resource,
      tags,
      actorId: req.user.id,
      changedAt: new Date().toISOString(),
    });
  });

  return next();
};
