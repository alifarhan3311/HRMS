const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../src/modules/assets/assets.validation');

test('asset inventory auto-generates identity and requires category', () => {
  const valid = validation.createSchema.validate({
    category: 'Laptop', brand: 'Dell', model: 'Latitude',
  });
  assert.equal(valid.error, undefined);
  assert.equal(validation.createSchema.validate({ brand: 'Dell' }).error !== undefined, true);
});

test('asset assignment requires an employee and assignment date', () => {
  const result = validation.assignSchema.validate({
    employeeId: '64b7a8df44789a0012345678', assignmentDate: '2026-08-11',
  });
  assert.equal(result.error, undefined);
  assert.equal(validation.assignSchema.validate({ assignmentDate: '2026-08-11' }).error !== undefined, true);
});

test('asset lifecycle accepts supported states and rejects unknown states', () => {
  assert.equal(validation.statusSchema.validate({ status: 'lost', description: 'Reported missing' }).error, undefined);
  assert.equal(validation.statusSchema.validate({ status: 'deleted' }).error !== undefined, true);
});

test('maintenance accepts nullable repair date and validated costs', () => {
  const valid = validation.maintenanceSchema.validate({
    issue: 'Battery replacement', reportedDate: '2026-08-11',
    sentForRepairDate: null, repairCost: 2500,
  });
  assert.equal(valid.error, undefined);
  assert.equal(validation.maintenanceSchema.validate({ issue: 'Repair', reportedDate: '2026-08-11', repairCost: -1 }).error !== undefined, true);
});
