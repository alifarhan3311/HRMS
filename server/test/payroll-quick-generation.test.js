const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);

const service = require('../src/modules/payroll/payroll.service');
const repository = require('../src/modules/payroll/payroll.repository');
const Employee = require('../src/modules/employees/employees.model');
const Attendance = require('../src/modules/attendance/attendance.model');
const LeaveRequest = require('../src/modules/leaves/leaves.model');
const Fine = require('../src/modules/fines/fine.model');
const settings = require('../src/modules/companySettings/companySettings.service');
const notifications = require('../src/modules/notifications/notifications.service');

const actor = { id: 'hr-1', companyId: 'company-1', role: 'hr' };
const employee = { _id: 'employee-1', fullName: 'Test Employee', currentSalary: 30000, department: 'digital media' };
const payload = { employeeId: employee._id, month: 9, year: 2026 };
function setup(t) {
  const saved = [];
  t.mock.method(repository, 'findByEmployeeAndPeriod', async () => null);
  t.mock.method(repository, 'create', async data => {
    const record = { _id: `payslip-${saved.length + 1}`, ...data };
    saved.push(record);
    return { ...record, toObject: () => ({ ...record }) };
  });
  t.mock.method(Employee, 'findOne', () => ({ populate: async () => employee }));
  t.mock.method(Employee, 'find', async () => [employee]);
  t.mock.method(Attendance, 'find', async () => [{ status: 'absent', shiftDate: '2026-09-01' }, { status: 'half_day', shiftDate: '2026-09-02' }]);
  t.mock.method(LeaveRequest, 'find', () => ({ select: async () => [] }));
  t.mock.method(Fine, 'find', async () => []);
  t.mock.method(settings, 'getPolicy', async () => ({ payrollPolicy: {} }));
  const notification = t.mock.method(notifications, 'createNotification', async () => ({}));
  return { saved, notification };
}

test('legacy generation stays draft; quick generation saves approval without marking paid', async t => {
  const { saved, notification } = setup(t);
  const draft = await service.generatePayslip(payload, actor);
  const approved = await service.generatePayslip({ ...payload, approveImmediately: true }, actor);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.approvedBy, undefined);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, actor.id);
  assert.ok(approved.approvedAt instanceof Date);
  assert.equal(approved.paidAt, undefined);
  assert.equal(approved.netSalary, draft.netSalary);
  assert.deepEqual(approved.deductionItems, draft.deductionItems);
  assert.equal(saved.length, 2);
  assert.equal(notification.mock.callCount(), 1);
});

test('quick approval rejects unauthorized roles and invalid options before writes', async t => {
  const { saved } = setup(t);
  await assert.rejects(service.generatePayslip({ ...payload, approveImmediately: true }, { ...actor, role: 'employee' }), { status: 403 });
  await assert.rejects(service.generatePayslip({ ...payload, approveImmediately: 'true' }, actor), { status: 400 });
  await assert.rejects(service.bulkGeneratePayslips({ ...payload, month: 13 }, actor), { status: 400 });
  assert.equal(saved.length, 0);
});

test('duplicate payslips cannot be regenerated or silently approved', async t => {
  const { saved } = setup(t);
  repository.findByEmployeeAndPeriod.mock.mockImplementation(async () => ({ status: 'draft' }));
  await assert.rejects(service.generatePayslip({ ...payload, approveImmediately: true }, actor), { status: 409 });
  assert.equal(saved.length, 0);
});

test('bulk shortcut approves new payslips and reports skipped and failed employees', async t => {
  const { saved } = setup(t);
  Employee.find.mock.mockImplementation(async () => [employee,
    { ...employee, _id: 'existing' }, { ...employee, _id: 'no-salary', currentSalary: 0 }]);
  repository.findByEmployeeAndPeriod.mock.mockImplementation(async id => id === 'existing' ? { status: 'paid' } : null);
  const result = await service.bulkGeneratePayslips({ month: 9, year: 2026, approveImmediately: true }, actor);
  assert.equal(result.generatedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0].employeeId, 'no-salary');
  assert.equal(saved[0].status, 'approved');
  assert.equal(saved[0].paidAt, undefined);
});

test('notification failure reports a warning without disguising a saved approval as failure', async t => {
  const { saved, notification } = setup(t);
  notification.mock.mockImplementation(async () => { throw new Error('Notification service unavailable'); });
  const result = await service.generatePayslip({ ...payload, approveImmediately: true }, actor);
  assert.equal(result.status, 'approved');
  assert.equal(result.notificationWarning, true);
  assert.equal(saved.length, 1);
});
