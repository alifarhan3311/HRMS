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
  applyBiometricTimeOffset,
  pollingIntervalForMode,
  inputFromStoredPunch,
  reconciliationCandidates,
} = require('../src/integrations/zkteco/zkteco.service');
const { classifyBiometricPunch } = require('../src/modules/attendance/attendance.service');

const punch = {
  deviceUserId: '25',
  punchTime: new Date('2026-07-25T04:00:00.000Z'),
  verificationMode: 'face',
  punchStatus: '0',
};

test('native realtime keeps slower reconciliation polling enabled', () => {
  const cfg = { pollInterval: 5000, reconcileInterval: 30000 };
  assert.equal(pollingIntervalForMode(true, cfg), 30000);
  assert.equal(pollingIntervalForMode(false, cfg), 5000);
});

test('partial attendance downloads use the durable timestamp cursor instead of log counts', () => {
  const logs = [
    { punchTime: new Date('2026-07-31T10:00:00.000Z') },
    { punchTime: new Date('2026-07-31T11:00:00.000Z') },
    { punchTime: new Date('2026-07-31T12:00:00.000Z') },
  ];
  assert.deepEqual(
    reconciliationCandidates(logs, new Date('2026-07-31T10:30:00.000Z')),
    logs.slice(1),
  );
});

test('reconciliation overlap recovers an older punch after a newer cursor without importing pre-initialization history', () => {
  const logs = [
    { punchTime: new Date('2026-08-12T13:16:23.000Z') },
    { punchTime: new Date('2026-08-12T21:03:41.000Z') },
  ];
  assert.deepEqual(
    reconciliationCandidates(
      logs,
      new Date('2026-08-12T21:03:41.000Z'),
      7 * 86400000,
      new Date('2026-08-12T00:00:00.000Z'),
    ),
    logs,
  );
  assert.deepEqual(
    reconciliationCandidates(logs, new Date('2026-08-12T21:03:41.000Z'), 0),
    logs.slice(1),
  );
});

test('stored received punches can be reconstructed after a process restart', () => {
  const stored = {
    deviceUserId: '23',
    machineTimestamp: new Date('2026-07-29T11:32:18.000Z'),
    correctedTimestamp: new Date('2026-07-29T23:32:18.000Z'),
    biometricOffsetHours: 12,
    punchTime: new Date('2026-07-29T23:32:18.000Z'),
    verificationMode: 'finger',
    punchStatus: 'unknown',
    transportSource: 'realtime',
    raw: { deviceUserId: '23' },
  };
  assert.deepEqual(inputFromStoredPunch(stored), {
    deviceUserId: '23',
    machineTimestamp: stored.machineTimestamp,
    correctedTimestamp: stored.correctedTimestamp,
    biometricOffsetHours: 12,
    punchTime: stored.punchTime,
    verificationMode: 'finger',
    punchStatus: 'unknown',
    source: 'realtime',
    raw: stored.raw,
  });
});

test('biometric duplicate fingerprint is stable and changes with dedupe fields', () => {
  const first = punchFingerprint(punch, '192.168.1.5:4370');
  assert.equal(first, punchFingerprint({ ...punch }, '192.168.1.5:4370'));
  assert.notEqual(first, punchFingerprint({ ...punch, punchStatus: '1' }, '192.168.1.5:4370'));
  assert.notEqual(first, punchFingerprint({ ...punch, verificationMode: 'finger' }, '192.168.1.5:4370'));
});

test('biometric timestamp offset corrects same-day machine time', () => {
  const corrected = applyBiometricTimeOffset(new Date('2026-07-26T06:00:00.000Z'), 12);
  assert.equal(corrected.toISOString(), '2026-07-26T18:00:00.000Z');
});

test('biometric timestamp offset crosses midnight', () => {
  const corrected = applyBiometricTimeOffset(new Date('2026-07-26T14:00:00.000Z'), 12);
  assert.equal(corrected.toISOString(), '2026-07-27T02:00:00.000Z');
});

test('biometric timestamp offset handles month and year rollover and negative offsets', () => {
  assert.equal(
    applyBiometricTimeOffset(new Date('2026-07-31T23:30:00.000Z'), 12).toISOString(),
    '2026-08-01T11:30:00.000Z',
  );
  assert.equal(
    applyBiometricTimeOffset(new Date('2026-12-31T18:30:00.000Z'), 12).toISOString(),
    '2027-01-01T06:30:00.000Z',
  );
  assert.equal(
    applyBiometricTimeOffset(new Date('2026-07-26T02:00:00.000Z'), -5).toISOString(),
    '2026-07-25T21:00:00.000Z',
  );
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

test('shift-aware biometric policy ignores repeated entry punches and accepts checkout', () => {
  const schedule = {
    scheduledStart: new Date('2026-07-27T13:00:00.000Z'),
    scheduledEnd: new Date('2026-07-27T21:00:00.000Z'),
  };
  const shift = { shiftType: 'fixed', requiredMinutes: 480 };
  const record = {
    signInTime: new Date('2026-07-27T13:11:58.000Z'),
    ...schedule,
    shiftType: 'fixed',
  };

  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T13:17:02.000Z'),
    schedule,
    shift,
  }), 'duplicate_sign_in_ignored');
  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T21:02:13.000Z'),
    schedule,
    shift,
  }), 'sign_out');
});

test('shift-aware biometric policy rejects out-of-order and post-checkout punches', () => {
  const schedule = {
    scheduledStart: new Date('2026-07-27T13:00:00.000Z'),
    scheduledEnd: new Date('2026-07-27T21:00:00.000Z'),
  };
  const record = {
    signInTime: new Date('2026-07-27T13:17:02.000Z'),
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    shiftType: 'fixed',
  };
  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T13:11:58.000Z'),
    schedule,
  }), 'stale_punch_ignored');
  assert.equal(classifyBiometricPunch({
    record: { ...record, signOutTime: new Date('2026-07-27T21:02:13.000Z') },
    punchTime: new Date('2026-07-27T21:03:00.000Z'),
    schedule,
  }), 'extra_punch_ignored');
});

test('flexible biometric policy waits until half the required duration before checkout', () => {
  const signInTime = new Date('2026-07-27T13:00:00.000Z');
  const record = { signInTime, shiftType: 'flexible', shiftRequiredMinutes: 360 };
  const schedule = {
    scheduledStart: signInTime,
    scheduledEnd: new Date('2026-07-27T19:00:00.000Z'),
  };
  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T13:10:00.000Z'),
    schedule,
  }), 'duplicate_sign_in_ignored');
  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T16:00:00.000Z'),
    schedule,
  }), 'sign_out');
});

test('flexible checkout after midnight remains a sign-out for the open shift', () => {
  const signIn = new Date('2026-07-27T14:11:31.000Z');
  const record = {
    shiftType: 'flexible',
    signInTime: signIn,
    effectiveRequiredMinutes: 480,
    scheduledStart: signIn,
    scheduledEnd: new Date('2026-07-27T22:11:31.000Z'),
  };
  assert.equal(classifyBiometricPunch({
    record,
    punchTime: new Date('2026-07-27T23:21:24.000Z'),
    schedule: record,
    shift: { shiftType: 'flexible', requiredMinutes: 480 },
  }), 'sign_out');
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
