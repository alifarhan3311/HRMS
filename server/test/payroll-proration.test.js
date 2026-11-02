const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { buildPayrollPeriod } = require('../src/modules/payroll/prorationPolicy');
const service = require('../src/modules/payroll/payroll.service');
const repository = require('../src/modules/payroll/payroll.repository');
const Employee = require('../src/modules/employees/employees.model');
const Attendance = require('../src/modules/attendance/attendance.model');
const Leave = require('../src/modules/leaves/leaves.model');
const Fine = require('../src/modules/fines/fine.model');
const commissions = require('../src/modules/training/salesCommission.service');
const settings = require('../src/modules/companySettings/companySettings.service');

const employee = { _id: 'employee-one', companyId: 'company-one', fullName: 'Joining-month employee',
  department: 'call center', joiningDate: new Date('2026-10-17'), currentSalary: 25000,
  shiftId: { workingDays: [1, 2, 3, 4, 5, 6], requiredMinutes: 480 } };
const actor = { id: 'hr-one', role: 'hr', companyId: employee.companyId };
const periodInput = { month: 10, year: 2026, monthlySalary: 25000 };
const rows = ['17', '19', '20', '21', '22', '23', '24', '26', '27', '28', '29', '31']
  .map(day => ({ status: 'present', shiftDate: `2026-10-${day}` }));
rows.push({ status: 'half_day', shiftDate: '2026-10-30' });

function setup(t, person = employee, records = rows, leaves = []) {
  t.mock.method(Employee, 'findOne', () => ({ populate: async () => person }));
  t.mock.method(Employee, 'find', () => ({ populate: () => ({ sort: async () => [person] }) }));
  const attendance = t.mock.method(Attendance, 'find', async () => records);
  t.mock.method(Leave, 'find', () => ({ select: async () => leaves }));
  t.mock.method(Fine, 'find', async () => []);
  t.mock.method(settings, 'getPolicy', async () => ({ payrollPolicy: {} }));
  const commission = t.mock.method(commissions, 'getPayrollCommissionItems', async () => []);
  t.mock.method(repository, 'findByEmployeeAndPeriod', async () => null);
  const save = t.mock.method(repository, 'create', async data => ({ toObject: () => data }));
  return { attendance, commission, save };
}

test('17–31 October is 15 calendar days at the fixed 30-day salary basis', () => {
  const result = buildPayrollPeriod({ ...periodInput, joiningDate: '2026-10-17' });
  assert.equal(result.periodBasicSalary, 12500);
  assert.deepEqual(result.salaryProration, { applied: true, periodStart: '2026-10-17', periodEnd: '2026-10-31', eligibleDays: 15, salaryDays: 15, basisDays: 30 });
});

test('full-month salaries stay unchanged in 28, 29, 30 and 31-day months', () => {
  for (const [month, year] of [[2, 2025], [2, 2024], [9, 2026], [10, 2026]]) {
    for (const joiningDate of [undefined, '2020-01-01', `${year}-${String(month).padStart(2, '0')}-01`]) {
      const result = buildPayrollPeriod({ ...periodInput, month, year, joiningDate });
      assert.equal(result.periodBasicSalary, 25000);
      assert.equal(result.salaryProration.applied, false);
      assert.equal(result.salaryProration.salaryDays, 30);
    }
  }
  assert.equal(buildPayrollPeriod({ ...periodInput, monthlySalary: 25000.5, joiningDate: '2020-01-01' }).periodBasicSalary, 25000.5);
});

test('last-day joiner receives one salary day and future joiner receives no salary', () => {
  assert.equal(buildPayrollPeriod({ ...periodInput, joiningDate: '2026-10-31' }).periodBasicSalary, 833);
  const future = buildPayrollPeriod({ ...periodInput, joiningDate: '2026-11-01' });
  assert.equal(future.employedDuringPeriod, false);
  assert.equal(future.periodBasicSalary, 0);
  assert.throws(() => buildPayrollPeriod({ ...periodInput, joiningDate: 'invalid-date' }), { status: 422 });
});

test('live payroll prorates base pay before half-day deductions and preserves the full daily rate', async t => {
  const { attendance } = setup(t);
  const { items: [row] } = await service.getLivePayroll({ month: 10, year: 2026 }, actor);
  assert.equal(row.monthlySalary, 25000);
  assert.equal(row.periodBasicSalary, 12500);
  assert.equal(row.halfDayDeduction, 417);
  assert.equal(row.earnedSalary, 10417);
  assert.equal(row.netPayable, 12083);
  assert.equal(row.workingDays, 13);
  assert.equal(attendance.mock.calls[0].arguments[0].date.$gte.toISOString(), '2026-10-17T00:00:00.000Z');
});

test('new saved payslip uses the same prorated base and net as live payroll', async t => {
  setup(t);
  const live = (await service.getLivePayroll({ month: 10, year: 2026 }, actor)).items[0];
  const saved = await service.generatePayslip({ employeeId: employee._id, month: 10, year: 2026 }, actor);
  assert.equal(saved.basicSalary, '25000');
  assert.equal(saved.periodBasicSalary, '12500');
  assert.equal(saved.grossSalary, '12500');
  assert.equal(Number(saved.netSalary), live.netPayable);
  assert.deepEqual(saved.salaryProration, live.salaryProration);
});

test('pre-joining records and the pre-joining part of leave are not deducted', async t => {
  setup(t, employee, [{ status: 'absent', shiftDate: '2026-10-01' }, ...rows], [
    { leaveType: 'unpaid', startDate: '2026-10-01', endDate: '2026-10-18' },
  ]);
  const row = (await service.getLivePayroll({ month: 10, year: 2026 }, actor)).items[0];
  assert.equal(row.absent, 2); // Only 17 and 18 October, never 1–16 October.
  assert.equal(row.absenceDeduction, 1667);
  assert.equal(row.netPayable, 10416);
});

test('joining-month commission is added once, not prorated', async t => {
  const { commission } = setup(t);
  commission.mock.mockImplementation(async () => [{ label: 'ATM Commission', amount: 10000 }]);
  const row = (await service.getLivePayroll({ month: 10, year: 2026 }, actor)).items[0];
  const saved = await service.generatePayslip({ employeeId: employee._id, month: 10, year: 2026 }, actor);
  assert.equal(row.commissionTotal, 10000);
  assert.equal(row.netPayable, 22083);
  assert.equal(Number(saved.netSalary), 22083);
});

test('future joiners are not listed or allowed to generate a pre-employment payslip', async t => {
  const { attendance, save } = setup(t, { ...employee, joiningDate: '2026-11-01' });
  assert.equal((await service.getLivePayroll({ month: 10, year: 2026 }, actor)).items.length, 0);
  await assert.rejects(service.generatePayslip({ employeeId: employee._id, month: 10, year: 2026 }, actor), { status: 422 });
  assert.equal(attendance.mock.callCount(), 0);
  assert.equal(save.mock.callCount(), 0);
});

test('monthly-hours joiner gets a proportional target without reducing the hourly rate twice', async t => {
  setup(t, { ...employee, department: 'accounting', currentSalary: 30000 }, [
    { shiftDate: '2026-10-10', status: 'present', workedMinutes: 6000 },
    { shiftDate: '2026-10-17', status: 'present', workedMinutes: 4800 },
  ]);
  const row = (await service.getLivePayroll({ month: 10, year: 2026 }, actor)).items[0];
  const saved = await service.generatePayslip({ employeeId: employee._id, month: 10, year: 2026 }, actor);
  assert.equal(row.periodBasicSalary, 15000);
  assert.equal(row.monthlyTargetHours, 92);
  assert.equal(row.monthlyCompletedHours, 80);
  assert.equal(row.monthlyRemainingHours, 12);
  assert.equal(row.monthlyAttendanceDeduction, 1500);
  assert.equal(row.netPayable, 13500);
  assert.equal(Number(saved.netSalary), row.netPayable);
});

test('prorated basic salary is encrypted in saved document storage', () => {
  const Payslip = require('../src/modules/payroll/payroll.model');
  const slip = new Payslip({ basicSalary: '25000', periodBasicSalary: '12500' });
  assert.notEqual(slip.get('periodBasicSalary', null, { getters: false }), '12500');
  assert.equal(slip.periodBasicSalary, '12500');
});
