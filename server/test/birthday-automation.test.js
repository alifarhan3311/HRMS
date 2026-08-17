const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const {
  birthdayDateContext,
  isAttendanceDateAfterReset,
  missedSignOutClosure,
  saturdayMissedSignOutClosure,
  missingPunchStatus,
} = require('../src/jobs/hrAutomation');
const { smtpSecure } = require('../src/config/mailer');

test('birthday automation identifies exact company-local midnight and tomorrow', () => {
  const context = birthdayDateContext(new Date('2026-07-23T19:00:00.000Z'), 'Asia/Karachi');
  assert.equal(context.todayKey, '2026-07-24');
  assert.equal(context.isMidnightMinute, true);
  assert.deepEqual(context.tomorrow, { year: 2026, month: 7, day: 25 });
});

test('birthday date context handles year rollover and does not run outside midnight minute', () => {
  const midnight = birthdayDateContext(new Date('2026-12-30T19:00:00.000Z'), 'Asia/Karachi');
  assert.deepEqual(midnight.tomorrow, { year: 2027, month: 1, day: 1 });
  assert.equal(midnight.isMidnightMinute, true);

  const later = birthdayDateContext(new Date('2026-12-30T19:01:00.000Z'), 'Asia/Karachi');
  assert.equal(later.isMidnightMinute, false);
  const twoHoursBefore = birthdayDateContext(new Date('2026-12-31T17:00:00.000Z'), 'Asia/Karachi');
  assert.equal(twoHoursBefore.isTwoHourReminderMinute, true);
  assert.deepEqual(twoHoursBefore.tomorrow, { year: 2027, month: 1, day: 1 });
});

test('attendance reset prevents historical absences from being regenerated', () => {
  const resetAt = new Date('2026-07-24T17:30:57.380Z');
  assert.equal(isAttendanceDateAfterReset(new Date('2026-07-23T12:00:00.000Z'), resetAt, 'Asia/Karachi'), false);
  assert.equal(isAttendanceDateAfterReset(new Date('2026-07-24T12:00:00.000Z'), resetAt, 'Asia/Karachi'), false);
  assert.equal(isAttendanceDateAfterReset(new Date('2026-07-25T12:00:00.000Z'), resetAt, 'Asia/Karachi'), true);
});

test('missed sign-out never fabricates a scheduled-end sign-out or worked hours', () => {
  const result = missedSignOutClosure(new Date('2026-07-25T02:00:00.000Z'), {
    scheduledStart: new Date('2026-07-24T18:00:00.000Z'),
    signInTime: new Date('2026-07-24T18:10:00.000Z'),
  });
  assert.equal(result.status, 'late');
  assert.equal(result.workedMinutes, 0);
  assert.equal(result.totalHours, 0);
  assert.equal(Object.hasOwn(result, 'signOutTime'), false);
});

test('one missing punch uses the 150-minute late versus half-day boundary', () => {
  const start = new Date('2026-08-12T13:00:00.000Z');
  const end = new Date('2026-08-12T21:00:00.000Z');
  assert.equal(missingPunchStatus({ scheduledStart: start, signInTime: new Date('2026-08-12T15:30:00.000Z') }, 'sign_out'), 'late');
  assert.equal(missingPunchStatus({ scheduledStart: start, signInTime: new Date('2026-08-12T15:31:00.000Z') }, 'sign_out'), 'half_day');
  assert.equal(missingPunchStatus({ scheduledEnd: end, signOutTime: new Date('2026-08-12T18:30:00.000Z') }, 'sign_in'), 'late');
  assert.equal(missingPunchStatus({ scheduledEnd: end, signOutTime: new Date('2026-08-12T18:29:00.000Z') }, 'sign_in'), 'half_day');
  assert.equal(missingPunchStatus({}, 'sign_in'), 'absent');
});

test('Saturday sign-in remains present without any sign-out penalty', () => {
  const result = saturdayMissedSignOutClosure(new Date('2026-07-26T02:00:00.000Z'));
  assert.equal(result.status, 'present');
  assert.equal(Object.hasOwn(result, 'missedPunchType'), false);
  assert.equal(result.workedMinutes, 0);
  assert.equal(result.lateMinutes, 0);
});

test('SMTP port 465 always enables implicit TLS', () => {
  assert.equal(smtpSecure(465, false), true);
  assert.equal(smtpSecure(587, false), false);
  assert.equal(smtpSecure(587, true), true);
});
