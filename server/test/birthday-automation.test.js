const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { birthdayDateContext } = require('../src/jobs/hrAutomation');
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
});

test('SMTP port 465 always enables implicit TLS', () => {
  assert.equal(smtpSecure(465, false), true);
  assert.equal(smtpSecure(587, false), false);
  assert.equal(smtpSecure(587, true), true);
});
