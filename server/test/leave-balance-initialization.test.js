const test = require('node:test');
const assert = require('node:assert/strict');
const { leaveBalanceInitializationSchema } = require('../src/modules/employees/employees.validation');

test('HR leave balance initialization accepts full-year balances without a reason', () => {
  const result = leaveBalanceInitializationSchema.validate({
    balances: {
      annual: { entitlement: 16, used: 1 },
      sick: { entitlement: 6, used: 0 },
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.mode, 'full_year');
  assert.equal(result.value.reason, '');
  assert.equal(result.value.confirmAdjustment, false);
});

test('leave balance initialization rejects unsupported modes and unknown leave types', () => {
  const result = leaveBalanceInitializationSchema.validate({
    mode: 'prorated',
    balances: {
      annual: { entitlement: 10, used: 0 },
      sick: { entitlement: 5, used: 0 },
      casual: { entitlement: 5, used: 0 },
    },
  });
  assert.ok(result.error);
});
