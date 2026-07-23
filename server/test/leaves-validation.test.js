const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { createSchema, decisionSchema, cancelSchema } = require('../src/modules/leaves/leaves.validation');
const { calcWorkingDays } = require('../src/modules/leaves/leaves.service');

test('leave application requires a supported type and a valid ordered ISO date range', () => {
  const valid = createSchema.validate({
    leaveType: 'casual',
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

test('leave decision and cancellation payloads reject unknown workflow fields', () => {
  assert.equal(decisionSchema.validate({ remarks: 'Approved' }).error, undefined);
  assert.equal(cancelSchema.validate({ reason: 'Plans changed' }).error, undefined);
  assert.ok(decisionSchema.validate({ status: 'approved' }).error);
  assert.ok(cancelSchema.validate({ approvalChain: [] }).error);
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
