const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWorkMode,
  canUseSelfServiceSignIn,
  buildWorkModeFilter,
} = require('../src/modules/attendance/workModePolicy');

test('existing records and employees without workMode remain office', () => {
  assert.equal(normalizeWorkMode(undefined), 'office');
  assert.equal(normalizeWorkMode('office'), 'office');
  assert.equal(canUseSelfServiceSignIn({}), false);
});

test('only WFH employees can use self-service sign-in', () => {
  assert.equal(canUseSelfServiceSignIn({ workMode: 'wfh' }), true);
  assert.equal(canUseSelfServiceSignIn({ workMode: 'office' }), false);
});

test('office filter includes legacy attendance records', () => {
  assert.deepEqual(buildWorkModeFilter('office'), {
    $or: [
      { workMode: 'office' },
      { workMode: { $exists: false } },
    ],
  });
  assert.deepEqual(buildWorkModeFilter('wfh'), { workMode: 'wfh' });
  assert.deepEqual(buildWorkModeFilter(), {});
});
