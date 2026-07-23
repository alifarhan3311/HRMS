const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { normalizeDurationPolicy } = require('../src/modules/shifts/shifts.service');
const { arrivalStatus } = require('../src/modules/attendance/shiftTime');
const { appliesToEmployee } = require('../src/modules/attendance/closurePolicy');

const start = new Date('2026-07-23T20:00:00.000Z');
const schedule = { scheduledStart: start };

test('fixed shifts longer than seven hours receive 15 minute grace and 150 minute half-day arrival threshold', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'fixed', startTime: '20:00', endTime: '04:00', breakMinutes: 0,
  });
  assert.equal(shift.requiredMinutes, 480);
  assert.equal(shift.graceMinutes, 15);
  assert.equal(shift.lateHalfDayAfterMinutes, 150);
  assert.equal(arrivalStatus(new Date(start.getTime() + 15 * 60000), schedule, shift).status, 'present');
  assert.equal(arrivalStatus(new Date(start.getTime() + 16 * 60000), schedule, shift).status, 'late');
  assert.equal(arrivalStatus(new Date(start.getTime() + 151 * 60000), schedule, shift).status, 'half_day');
});

test('fixed shifts of seven hours or less have no grace and use a 120 minute half-day arrival threshold', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'fixed', startTime: '10:00', endTime: '16:30', breakMinutes: 0,
  });
  assert.equal(shift.requiredMinutes, 390);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(shift.lateHalfDayAfterMinutes, 120);
  assert.equal(arrivalStatus(new Date(start.getTime() + 59 * 1000), schedule, shift).status, 'present');
  assert.equal(arrivalStatus(new Date(start.getTime() + 1 * 60000), schedule, shift).status, 'late');
  assert.equal(arrivalStatus(new Date(start.getTime() + 121 * 60000), schedule, shift).status, 'half_day');
});

test('flexible 8-hour shifts have no late status and reach worked half-day at four hours', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'flexible', startTime: '00:00', endTime: '08:00', breakMinutes: 0,
  });
  assert.equal(shift.requiredMinutes, 480);
  assert.equal(shift.halfDayMinutes, 240);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(arrivalStatus(new Date(start.getTime() + 600 * 60000), schedule, shift).status, 'present');
});

test('flexible 6-hour shifts have no late status and reach worked half-day at three hours', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'flexible', startTime: '00:00', endTime: '06:00', requiredMinutes: 360, breakMinutes: 0,
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
