const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);

const { calculateAttendancePayroll } = require('../src/modules/payroll/payroll.service');

test('payroll calculates absence, half-day, unpaid leave, and every three lates transparently', () => {
  const result = calculateAttendancePayroll({
    basicSalary: 30000,
    workingDays: 30,
    absent: 1,
    halfDay: 1,
    late: 5,
    unpaidLeave: 2,
    requiredMinutes: 360,
  });

  assert.equal(result.perDaySalary, 1000);
  assert.equal(Math.round(result.perHourSalary), 167);
  assert.equal(result.absenceDeduction, 1000);
  assert.equal(result.halfDayDeduction, 500);
  assert.equal(result.lateDeductionDays, 0.5);
  assert.equal(result.lateDeduction, 500);
  assert.equal(result.unpaidLeaveDeduction, 2000);
});
