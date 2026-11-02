const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const service = require('../src/modules/training/salesCommission.service');
const Employee = require('../src/modules/employees/employees.model');
const Payslip = require('../src/modules/payroll/payroll.model');
const SalesCommission = require('../src/modules/training/salesCommission.model');
const commissionService = require('../src/modules/training/commission.service');
const a = '507f1f77bcf86cd799439011', b = '507f1f77bcf86cd799439012';
const actor = { id: a, companyId: '507f191e810c19729de860ea', role: 'hr' };
const rate = { slug: 'atm', name: 'ATM', amount: 5000, unit: 'PKR' };
const previous = quantity => ({ slug: 'atm', name: 'ATM', quantity, salesAmount: 0, unit: 'PKR', rate: 5000, commissionAmount: quantity * 5000 });
const entry = (employeeId, quantity) => ({ employeeId, products: { atm: { quantity } } });

function setup(t, lockedIds = [a], status = 'approved') {
  t.mock.method(Employee, 'find', () => ({ select: () => ({ lean: async () => [
    { _id: a, fullName: 'Locked Employee', department: 'call center' },
    { _id: b, fullName: 'Editable Employee', department: 'call center' },
  ] }) }));
  t.mock.method(commissionService, 'list', async () => [rate]);
  t.mock.method(SalesCommission, 'find', () => ({ select: () => ({ lean: async () => [
    { employeeId: a, items: [previous(2)] }, { employeeId: b, items: [previous(2)] },
  ] }) }));
  const lock = t.mock.method(Payslip, 'findOne', filter => {
    if (filter.status === 'draft') return Promise.resolve(null);
    return { select: () => ({ lean: async () => {
      const id = filter.employeeId.$in.find(value => lockedIds.includes(String(value)));
      return id ? { employeeId: id, status } : null;
    } }) };
  });
  const save = t.mock.method(SalesCommission, 'findOneAndUpdate', async (filter, update) => ({ ...filter, ...update.$set }));
  return { lock, save };
}

test('legacy save-all request skips unchanged locked employee and updates only the edited employee', async t => {
  const { lock, save } = setup(t);
  const result = await service.savePeriod({ month: 10, year: 2026, entries: [entry(a, 2), entry(b, 1)] }, actor);
  assert.equal(result.savedCount, 1);
  assert.equal(result.unchangedCount, 1);
  const lockFilter = lock.mock.calls[0].arguments[0];
  assert.deepEqual(lockFilter.employeeId.$in, [b]);
  assert.equal(lockFilter.companyId, actor.companyId);
  assert.equal(lockFilter.month, 10);
  assert.equal(lockFilter.year, 2026);
  assert.equal(save.mock.callCount(), 1);
  assert.equal(save.mock.calls[0].arguments[0].employeeId, b);
  assert.equal(save.mock.calls[0].arguments[1].$set.totalCommission, 5000);
});

test('pending, approved, paid and locked payroll still prevent edits to that same employee', async t => {
  const { lock, save } = setup(t, [b]);
  for (const status of ['pending_approval', 'approved', 'paid', 'locked']) {
    lock.mock.mockImplementation(filter => ({ select: () => ({ lean: async () => ({ employeeId: b, status }) }) }));
    await assert.rejects(service.savePeriod({ month: 10, year: 2026, entries: [entry(a, 2), entry(b, 1)] }, actor), error => error.status === 409 && error.message.includes('Editable Employee'));
  }
  assert.equal(save.mock.callCount(), 0);
});

test('cleared payroll no longer locks the edited employee and unchanged rows are not rewritten', async t => {
  const { save } = setup(t, []);
  await service.savePeriod({ month: 10, year: 2026, entries: [entry(a, 2), entry(b, 1)] }, actor);
  assert.equal(save.mock.calls[0].arguments[0].employeeId, b);
  assert.equal(save.mock.callCount(), 1);
});

test('unchanged save-all requests do not fail on locked payroll and do not write revisions', async t => {
  const { save, lock } = setup(t, [a, b]);
  assert.equal((await service.savePeriod({ month: 10, year: 2026, entries: [entry(a, 2), entry(b, 2)] }, actor)).savedCount, 0);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(lock.mock.callCount(), 0);
});

test('all entries are validated before any changed employee is saved', async t => {
  const { save } = setup(t, []);
  await assert.rejects(service.savePeriod({ month: 10, year: 2026, entries: [entry(a, 1), entry(b, -1)] }, actor), { status: 400 });
  assert.equal(save.mock.callCount(), 0);
});

test('cross-company and unauthorized sales edits are rejected before writes', async t => {
  const { save } = setup(t);
  await assert.rejects(service.savePeriod({ month: 10, year: 2026, entries: [entry(b, 1)] }, { ...actor, role: 'employee' }), { status: 403 });
  Employee.find.mock.mockImplementation(() => ({ select: () => ({ lean: async () => [] }) }));
  await assert.rejects(service.savePeriod({ month: 10, year: 2026, entries: [entry(b, 1)] }, actor), { status: 400 });
  assert.equal(save.mock.callCount(), 0);
});

test('period listing exposes each employee own payroll state, scoped to tenant and month', async t => {
  const people = [{ _id: a, department: 'call center' }, { _id: b, department: 'call center' }];
  t.mock.method(Employee, 'find', () => ({ select: () => ({ sort: () => ({ lean: async () => people }) }) }));
  t.mock.method(commissionService, 'list', async () => [rate]);
  t.mock.method(SalesCommission, 'find', () => ({ lean: async () => [] }));
  const payroll = t.mock.method(Payslip, 'find', () => ({ select: () => ({ lean: async () => [{ employeeId: a, status: 'paid' }] }) }));
  const result = await service.listPeriod({ month: 10, year: 2026 }, actor);
  assert.equal(result.employees[0].commissionLocked, true);
  assert.equal(result.employees[1].commissionLocked, false);
  assert.equal(result.employees[1].payrollStatus, null);
  assert.equal(payroll.mock.calls[0].arguments[0].companyId, actor.companyId);
  assert.equal(payroll.mock.calls[0].arguments[0].month, 10);
});
