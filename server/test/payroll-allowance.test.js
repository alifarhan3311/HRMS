const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const service = require('../src/modules/payroll/payrollAllowance.service');
const Employee = require('../src/modules/employees/employees.model');
const Payslip = require('../src/modules/payroll/payroll.model');
const Allowance = require('../src/modules/payroll/payrollAllowance.model');
const employeeId = '507f1f77bcf86cd799439011';
const actor = { id: '507f1f77bcf86cd799439012', companyId: '507f191e810c19729de860ea', role: 'hr' };
const input = { employeeId, month: 11, year: 2026, amount: 2500 };

function setup(t, slip = null, department = 'call center') {
  const session = {};
  const employee = t.mock.method(Employee, 'findOne', () => ({ select: async () => ({ department, joiningDate: '2020-01-01' }) }));
  const payroll = t.mock.method(Payslip, 'findOne', () => ({ session: async () => slip }));
  const transaction = t.mock.method(Payslip.db, 'transaction', async fn => fn(session));
  const save = t.mock.method(Allowance, 'findOneAndUpdate', async () => ({}));
  t.mock.method(Allowance.collection, 'createIndex', async () => 'monthly-key');
  return { employee, payroll, transaction, save, session };
}

test('only HR can change an allowance; role and input validation happen before database access', async t => {
  const { employee, save } = setup(t);
  for (const role of ['employee', 'manager', 'team_lead', 'floor_head', 'admin', 'super_admin']) {
    await assert.rejects(service.save(input, { ...actor, role }), { status: 403 });
  }
  for (const invalid of [{ amount: -1 }, { amount: Infinity }, { amount: '100' }, { amount: 1.234 }, { amount: 100000001 }, { month: 13 }, { year: 1999 }, { employeeId: { $ne: null } }, { companyId: 'forged' }]) {
    await assert.rejects(service.save({ ...input, ...invalid }, actor), { status: 400 });
  }
  assert.equal(employee.mock.callCount(), 0);
  assert.equal(save.mock.callCount(), 0);
});

test('cross-company employees, other departments and pre-employment months cannot receive an allowance', async t => {
  const { employee, save } = setup(t, null, 'accounting');
  await assert.rejects(service.save(input, actor), { status: 400 });
  employee.mock.mockImplementation(() => ({ select: async () => null }));
  await assert.rejects(service.save(input, actor), { status: 404 });
  employee.mock.mockImplementation(() => ({ select: async () => ({ department: 'Call-Centre', joiningDate: '2026-12-01' }) }));
  await assert.rejects(service.save(input, actor), { status: 400 });
  assert.equal(employee.mock.calls[0].arguments[0].companyId, actor.companyId);
  assert.equal(save.mock.callCount(), 0);
});

test('monthly allowance upsert is tenant/employee/period scoped and records the HR actor', async t => {
  const { save, payroll, session } = setup(t);
  assert.deepEqual(await service.save(input, actor), input);
  const [filter, update, options] = save.mock.calls[0].arguments;
  assert.deepEqual(filter, { companyId: actor.companyId, employeeId, month: 11, year: 2026 });
  assert.deepEqual(payroll.mock.calls[0].arguments[0], filter);
  assert.deepEqual(update.$set, { amount: 2500, updatedBy: actor.id });
  assert.equal(options.session, session);
  assert.equal(options.upsert, true);
});

test('pending, approved, paid and locked payslips reject writes without changing allowance or salary', async t => {
  const { payroll, save } = setup(t);
  for (const status of ['pending_approval', 'approved', 'paid', 'locked']) {
    payroll.mock.mockImplementation(() => ({ session: async () => ({ status }) }));
    await assert.rejects(service.save(input, actor), { status: 409 });
  }
  assert.equal(save.mock.callCount(), 0);
});

test('draft allowance edits and removal preserve other earnings, commissions and deductions without duplication', async t => {
  const slip = { status: 'draft', allowances: 3000, grossSalary: '53000', netSalary: '51000', deductions: 2000, taxDeduction: 0,
    allowanceItems: [{ label: 'Transport', amount: 1000 }, { label: 'Allowance (HR)', amount: 2000, source: 'hr_monthly' }],
    commissionTotal: 10000, save: async () => {},
  };
  setup(t, slip);
  await service.save(input, actor);
  assert.equal(slip.allowances, 3500);
  assert.equal(slip.grossSalary, '53500');
  assert.equal(slip.netSalary, '51500');
  assert.equal(slip.allowanceItems.filter(item => item.source === 'hr_monthly').length, 1);
  await service.save({ ...input, amount: 0 }, actor);
  assert.equal(slip.allowances, 1000);
  assert.equal(slip.grossSalary, '51000');
  assert.equal(slip.netSalary, '49000');
  assert.deepEqual(slip.allowanceItems, [{ label: 'Transport', amount: 1000 }]);
  assert.equal(slip.commissionTotal, 10000);
  assert.equal(slip.deductions, 2000);
});

test('zero allowance defaults safely and live state is scoped to the employee and month', async t => {
  const find = t.mock.method(Allowance, 'findOne', () => ({ lean: async () => ({ amount: 1250.50 }) }));
  t.mock.method(Payslip, 'findOne', () => ({ select: () => ({ lean: async () => ({ status: 'paid' }) }) }));
  const person = { _id: employeeId, companyId: actor.companyId, department: 'CALL CENTRE' };
  assert.deepEqual(await service.getState(person, 11, 2026), { allowanceAmount: 1250.5, allowanceLocked: true, allowancePayrollStatus: 'paid' });
  assert.deepEqual(find.mock.calls[0].arguments[0], { companyId: actor.companyId, employeeId, month: 11, year: 2026 });
  find.mock.mockImplementation(() => ({ lean: async () => null }));
  assert.equal(await service.getAmount(person, 10, 2026), 0);
  assert.equal(await service.getAmount({ ...person, department: 'accounting' }, 11, 2026), 0);
});
