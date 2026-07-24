const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
process.env.ZKTECO_COMPANY_ID ||= '667788990011223344556677';

const {
  punchFingerprint,
  employeeMappingFilter,
  attendanceActionForRecord,
  nextReconnectDelay,
  dataChangedPayload,
} = require('../src/integrations/zkteco/zkteco.service');

const punch = {
  deviceUserId: '25',
  punchTime: new Date('2026-07-25T04:00:00.000Z'),
  verificationMode: 'face',
  punchStatus: '0',
};

test('biometric duplicate fingerprint is stable and changes with dedupe fields', () => {
  const first = punchFingerprint(punch, '192.168.1.5:4370');
  assert.equal(first, punchFingerprint({ ...punch }, '192.168.1.5:4370'));
  assert.notEqual(first, punchFingerprint({ ...punch, punchStatus: '1' }, '192.168.1.5:4370'));
  assert.notEqual(first, punchFingerprint({ ...punch, verificationMode: 'finger' }, '192.168.1.5:4370'));
});

test('employee mapping is tenant-scoped, exact and active-only', () => {
  assert.deepEqual(employeeMappingFilter('company-a', 25), {
    companyId: 'company-a',
    biometricDeviceUserId: '25',
    status: 'active',
  });
});

test('biometric attendance sequence is sign-in, sign-out, then ignore extra punch', () => {
  assert.equal(attendanceActionForRecord(null), 'sign_in');
  assert.equal(attendanceActionForRecord({ signInTime: punch.punchTime }), 'sign_out');
  assert.equal(attendanceActionForRecord({
    signInTime: punch.punchTime,
    signOutTime: new Date('2026-07-25T12:00:00.000Z'),
  }), 'extra_punch_ignored');
});

test('reconnect uses capped exponential backoff', () => {
  assert.equal(nextReconnectDelay(0, 2000), 2000);
  assert.equal(nextReconnectDelay(3, 2000), 16000);
  assert.equal(nextReconnectDelay(10, 2000), 60000);
});

test('Socket.IO cache broadcast targets existing attendance consumers', () => {
  const payload = dataChangedPayload('192.168.1.5:4370', new Date('2026-07-25T05:00:00.000Z'));
  assert.equal(payload.resource, 'attendance');
  assert.deepEqual(payload.tags, ['Attendance', 'Dashboard', 'Reports', 'Payroll']);
  assert.match(payload.actorId, /^zkteco:/);
});
