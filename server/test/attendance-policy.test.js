const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { normalizeDurationPolicy } = require('../src/modules/shifts/shifts.service');
const { arrivalStatus } = require('../src/modules/attendance/shiftTime');
const { appliesToEmployee } = require('../src/modules/attendance/closurePolicy');
const {
  correctedWorkMetrics,
  completedFixedShiftStatus,
} = require('../src/modules/attendance/attendance.service');
const { isSaturdayShiftDate, saturdayStatus } = require('../src/modules/attendance/saturdayPolicy');
const Attendance = require('../src/modules/attendance/attendance.model');

const start = new Date('2026-07-23T20:00:00.000Z');
const schedule = { scheduledStart: start };

test('fixed shifts longer than seven hours receive 15 minute grace and 150 minute half-day arrival threshold', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'fixed', startTime: '20:00', endTime: '04:00', breakMinutes: 60,
  });
  assert.equal(shift.requiredMinutes, 480);
  assert.equal(shift.graceMinutes, 15);
  assert.equal(shift.lateHalfDayAfterMinutes, 150);
  assert.equal(arrivalStatus(new Date(start.getTime() + 15 * 60000), schedule, shift).status, 'present');
  assert.equal(arrivalStatus(new Date(start.getTime() + 15 * 60000 + 59000), schedule, shift).status, 'present');
  assert.equal(arrivalStatus(new Date(start.getTime() + 16 * 60000), schedule, shift).status, 'late');
  assert.equal(arrivalStatus(new Date(start.getTime() + 151 * 60000), schedule, shift).status, 'half_day');
});

test('fixed shift completed through scheduled end stays present when arrival is within grace', () => {
  const record = {
    shiftType: 'fixed',
    status: 'present',
    signInTime: new Date('2026-07-27T13:12:00.000Z'),
  };
  assert.equal(
    completedFixedShiftStatus(
      record,
      new Date('2026-07-27T21:07:00.000Z'),
      new Date('2026-07-27T21:00:00.000Z'),
    ),
    'present',
  );
  assert.equal(
    completedFixedShiftStatus(
      record,
      new Date('2026-07-27T20:59:00.000Z'),
      new Date('2026-07-27T21:00:00.000Z'),
    ),
    null,
  );
});

test('fixed shift completed through scheduled end preserves a genuine late arrival', () => {
  assert.equal(
    completedFixedShiftStatus(
      {
        shiftType: 'fixed',
        status: 'late',
        signInTime: new Date('2026-07-27T13:20:00.000Z'),
      },
      new Date('2026-07-27T21:05:00.000Z'),
      new Date('2026-07-27T21:00:00.000Z'),
    ),
    'late',
  );
});

test('fixed shifts of seven hours or less have no grace and use a 120 minute half-day arrival threshold', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'fixed', startTime: '10:00', endTime: '16:30',
  });
  assert.equal(shift.requiredMinutes, 390);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(shift.lateHalfDayAfterMinutes, 120);
  assert.equal(arrivalStatus(new Date(start.getTime() + 59 * 1000), schedule, shift).status, 'present');
  assert.equal(arrivalStatus(new Date(start.getTime() + 1 * 60000), schedule, shift).status, 'late');
  assert.equal(arrivalStatus(new Date(start.getTime() + 121 * 60000), schedule, shift).status, 'half_day');
});

test('approved correction ignores obsolete break snapshots and uses full clock time', () => {
  const metrics = correctedWorkMetrics(
    { shiftRequiredMinutes: 480, shiftHalfDayMinutes: 240, shiftBreakMinutes: 60 },
    new Date('2026-07-24T13:00:00.000Z'),
    new Date('2026-07-24T17:00:00.000Z'),
    0,
  );
  assert.equal(metrics.workedMinutes, 240);
  assert.equal(metrics.status, 'half_day');
});

test('flexible 8-hour shifts have no late status and reach worked half-day at four hours', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'flexible', startTime: '00:00', endTime: '08:00',
  });
  assert.equal(shift.requiredMinutes, 480);
  assert.equal(shift.halfDayMinutes, 240);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(arrivalStatus(new Date(start.getTime() + 600 * 60000), schedule, shift).status, 'present');
});

test('flexible 6-hour shifts have no late status and reach worked half-day at three hours', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'flexible', startTime: '00:00', endTime: '06:00', requiredMinutes: 360,
  });
  assert.equal(shift.requiredMinutes, 360);
  assert.equal(shift.halfDayMinutes, 180);
  assert.equal(shift.overtimeAfterMinutes, 360);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(shift.startTime, '00:00');
  assert.equal(shift.endTime, '06:00');
  assert.equal(arrivalStatus(new Date(start.getTime() + 600 * 60000), schedule, shift).status, 'present');
});

test('holiday scope matching supports all, department, and assigned shift targets', () => {
  const employee = { department: 'operations', shiftId: '6a5fe8009e028adeea8ab4b2' };
  assert.equal(appliesToEmployee({ affectedScope: 'all' }, employee), true);
  assert.equal(appliesToEmployee({ affectedScope: 'department', affectedDepartment: 'Operations' }, employee), true);
  assert.equal(appliesToEmployee({ affectedScope: 'shift', affectedShiftId: '6a5fe8009e028adeea8ab4b2' }, employee), true);
  assert.equal(appliesToEmployee({ affectedScope: 'department', affectedDepartment: 'sales' }, employee), false);
});

test('Saturday policy allows only present or absent for normal attendance', () => {
  assert.equal(isSaturdayShiftDate('2026-07-25'), true);
  assert.equal(isSaturdayShiftDate('2026-07-24'), false);
  assert.equal(saturdayStatus({ shiftDate: '2026-07-25', hasSignIn: true }), 'present');
  assert.equal(saturdayStatus({ shiftDate: '2026-07-25', hasSignIn: false }), 'absent');
  assert.equal(
    saturdayStatus({ shiftDate: '2026-07-25', hasSignIn: true, isFullDayClosure: true }),
    'holiday',
  );
  assert.equal(saturdayStatus({ shiftDate: '2026-07-24', hasSignIn: true }), null);
});

test('attendance records require one normalized shift date for duplicate prevention', () => {
  const record = new Attendance({
    employeeId: '667788990011223344556671',
    companyId: '667788990011223344556677',
    date: new Date('2026-07-27T12:00:00.000Z'),
    status: 'present',
  });
  assert.ok(record.validateSync()?.errors?.shiftDate);
  record.shiftDate = '2026-07-27';
  assert.equal(record.validateSync(), undefined);
});
