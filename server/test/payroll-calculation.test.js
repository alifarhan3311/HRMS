const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);

const { calculateAttendancePayroll, calculateSandwichDates } = require('../src/modules/payroll/payroll.service');

test('payroll calculates absence, half-day, unpaid leave, and every three lates transparently', () => {
  const result = calculateAttendancePayroll({
    basicSalary: 30000,
    workingDays: 26,
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
  assert.equal(result.lateDeductionDays, 1);
  assert.equal(result.lateDeduction, 1000);
  assert.equal(result.unpaidLeaveDeduction, 2000);
});

test('weekly offs and consecutive holidays between absence days become sandwich leave', () => {
  const sandwich = calculateSandwichDates({
    start: new Date('2026-07-01T00:00:00Z'),
    end: new Date('2026-07-31T23:59:59Z'),
    workingDayNumbers: [1, 2, 3, 4, 5, 6],
    records: [
      { shiftDate: '2026-07-04', status: 'absent' },
      { shiftDate: '2026-07-05', status: 'weekend' },
      { shiftDate: '2026-07-06', status: 'holiday' },
      { shiftDate: '2026-07-07', status: 'absent' },
    ],
    unpaidLeaveDates: new Set(),
  });
  assert.deepEqual([...sandwich].sort(), ['2026-07-05', '2026-07-06']);
});
