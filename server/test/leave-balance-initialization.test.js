const test = require('node:test');
const assert = require('node:assert/strict');
const { leaveBalanceInitializationSchema } = require('../src/modules/employees/employees.validation');

test('HR leave balance initialization accepts annual and sick opening balances', () => {
  const result = leaveBalanceInitializationSchema.validate({
    mode: 'prorated',
    effectiveDate: '2026-07-25',
    reason: 'Opening balances confirmed by HR records',
    balances: {
      annual: { entitlement: 7.01, used: 1 },
      sick: { entitlement: 2.63, used: 0 },
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.confirmAdjustment, false);
});

test('leave balance initialization rejects missing audit reason and unknown leave types', () => {
  const result = leaveBalanceInitializationSchema.validate({
    mode: 'manual',
    effectiveDate: '2026-07-25',
    balances: {
      annual: { entitlement: 10, used: 0 },
      sick: { entitlement: 5, used: 0 },
      casual: { entitlement: 5, used: 0 },
    },
  });
  assert.ok(result.error);
});
