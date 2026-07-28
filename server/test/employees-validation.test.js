const test = require('node:test');
const assert = require('node:assert/strict');

const { updateSchema } = require('../src/modules/employees/employees.validation');

test('HR employee update accepts a valid salary change', () => {
  const result = updateSchema.validate({ currentSalary: '75000' }, { stripUnknown: true });
  assert.equal(result.error, undefined);
  assert.equal(result.value.currentSalary, '75000');
});

test('employee update rejects negative or malformed salaries', () => {
  assert.ok(updateSchema.validate({ currentSalary: '-1' }).error);
  assert.ok(updateSchema.validate({ currentSalary: 'not-a-number' }).error);
  assert.ok(updateSchema.validate({ currentSalary: '50000.999' }).error);
});
