const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { normalizeDurationPolicy } = require('../src/modules/shifts/shifts.service');
const { arrivalStatus } = require('../src/modules/attendance/shiftTime');

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
  assert.equal(arrivalStatus(new Date(start.getTime() + 1 * 60000), schedule, shift).status, 'late');
  assert.equal(arrivalStatus(new Date(start.getTime() + 121 * 60000), schedule, shift).status, 'half_day');
});

test('flexible shifts always require eight hours, have no late status, and reach worked half-day at four hours', () => {
  const shift = normalizeDurationPolicy({}, {
    shiftType: 'flexible', startTime: '00:00', endTime: '08:00', breakMinutes: 0,
  });
  assert.equal(shift.requiredMinutes, 480);
  assert.equal(shift.halfDayMinutes, 240);
  assert.equal(shift.graceMinutes, 0);
  assert.equal(arrivalStatus(new Date(start.getTime() + 600 * 60000), schedule, shift).status, 'present');
});
