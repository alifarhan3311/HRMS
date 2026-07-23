const { emitToCompany } = require('../config/socket');

const RESOURCE_TAGS = {
  employees: ['Employees', 'Dashboard', 'Projects'],
  attendance: ['Attendance', 'Dashboard', 'Reports'],
  leaves: ['Leaves', 'Employees', 'Dashboard'],
  payroll: ['Payroll', 'Dashboard', 'Reports'],
  expenses: ['Expenses', 'ExpenseCategories', 'Dashboard', 'Reports'],
  projects: ['Projects', 'Employees', 'Dashboard'],
  holidays: ['Holidays', 'Attendance', 'Dashboard'],
  shifts: ['Shifts', 'Employees', 'Auth', 'Attendance'],
  notifications: ['Notifications', 'Dashboard'],
  'company-settings': ['Settings', 'Employees', 'Dashboard', 'Auth'],
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
