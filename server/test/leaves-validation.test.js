const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { leaveEligibilityDate, leaveAttendanceFilter } = require('../src/modules/leaves/leaves.service');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const {
  createSchema,
  lateConversionSchema,
  decisionSchema,
  cancelSchema,
} = require('../src/modules/leaves/leaves.validation');
const { calcWorkingDays } = require('../src/modules/leaves/leaves.service');

test('leave application requires a supported type and a valid ordered ISO date range', () => {
  const valid = createSchema.validate({
    leaveType: 'annual',
    startDate: '2026-07-22',
    endDate: '2026-07-24',
    reason: '',
  });
  assert.equal(valid.error, undefined);

  assert.ok(createSchema.validate({
    leaveType: 'other',
    startDate: 'not-a-date',
    endDate: '2026-07-20',
  }).error);

  assert.ok(createSchema.validate({
    leaveType: 'sick',
    startDate: '2026-07-24',
    endDate: '2026-07-22',
  }).error);
});

test('single-day leave only requires one selected date', () => {
  const result = createSchema.validate({
    leaveType: 'annual',
    startDate: '2026-07-24',
    reason: '',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.endDate, undefined);
});

test('legacy casual leave can no longer be submitted', () => {
  assert.ok(createSchema.validate({
    leaveType: 'casual',
    startDate: '2026-07-24',
  }).error);
});

test('leave decision and cancellation payloads reject unknown workflow fields', () => {
  assert.equal(decisionSchema.validate({ remarks: 'Approved' }).error, undefined);
  assert.equal(cancelSchema.validate({ reason: 'Plans changed' }).error, undefined);
  assert.ok(decisionSchema.validate({ status: 'approved' }).error);
  assert.ok(cancelSchema.validate({ approvalChain: [] }).error);
});

test('late conversion requires exactly three unique attendance records and a paid leave type', () => {
  const ids = [
    '667788990011223344556671',
    '667788990011223344556672',
    '667788990011223344556673',
  ];
  assert.equal(lateConversionSchema.validate({ leaveType: 'annual', attendanceIds: ids }).error, undefined);
  assert.ok(lateConversionSchema.validate({ leaveType: 'unpaid', attendanceIds: ids }).error);
  assert.ok(lateConversionSchema.validate({ leaveType: 'annual', attendanceIds: ids.slice(0, 2) }).error);
  assert.ok(lateConversionSchema.validate({ leaveType: 'annual', attendanceIds: [ids[0], ids[0], ids[2]] }).error);
});

test('an overnight shift interval consumes the duty day on which the shift starts', () => {
  const shift = { shiftType: 'fixed', startTime: '22:00', endTime: '04:30' };
  assert.equal(calcWorkingDays(
    new Date('2026-07-22T17:00:00.000Z'),
    new Date('2026-07-22T23:00:00.000Z'),
    [0, 6],
    shift,
    'Asia/Karachi',
  ), 1);
  assert.equal(calcWorkingDays(
    new Date('2026-07-22T17:00:00.000Z'),
    new Date('2026-07-23T23:00:00.000Z'),
    [0, 6],
    shift,
    'Asia/Karachi',
  ), 2);
  assert.equal(calcWorkingDays(
    new Date('2026-07-24T00:00:00.000Z'),
    new Date('2026-07-25T00:00:00.000Z'),
    [0, 6],
    shift,
    'Asia/Karachi',
  ), 1);
});

test('normal date-only leave remains inclusive across genuine multiple days', () => {
  const dayShift = { shiftType: 'fixed', startTime: '09:00', endTime: '17:00' };
  assert.equal(calcWorkingDays(
    new Date('2026-07-20T00:00:00.000Z'),
    new Date('2026-07-22T00:00:00.000Z'),
    [0, 6],
    dayShift,
    'Asia/Karachi',
  ), 3);
});
test('leave eligibility starts after three complete calendar months', () => {
  assert.equal(leaveEligibilityDate('2026-01-15').toISOString().slice(0, 10), '2026-04-15');
  assert.equal(leaveEligibilityDate('2026-01-31').toISOString().slice(0, 10), '2026-04-30');
});

test('approved leave attendance matching uses normalized duty dates', () => {
  const filter = leaveAttendanceFilter({
    employeeId: '64b7a8df44789a0012345678',
    companyId: '64b7a8df44789a0012345679',
    dutyDates: ['2026-08-12'],
    startDate: new Date('2026-08-12T00:00:00.000Z'),
    endDate: new Date('2026-08-12T23:59:59.999Z'),
  });
  assert.deepEqual(filter.$or[0], { shiftDate: { $in: ['2026-08-12'] } });
  assert.equal(filter.$or[1].$and[1].$or[0].date.$gte.toISOString(), '2026-08-12T00:00:00.000Z');
  assert.deepEqual(filter.$or[1].$and[0], { $or: [{ shiftDate: { $exists: false } }, { shiftDate: null }] });
});
