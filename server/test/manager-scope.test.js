const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY = '01'.repeat(32);
const {
  buildManagerEmployeeScope,
  managerCanAccessEmployee,
} = require('../src/modules/employees/managerScope');

const actor = {
  id: '667788990011223344556677',
  companyId: '667788990011223344556600',
  role: 'manager',
  managedDepartments: ['accounting', 'Operations'],
};

test('manager scope includes direct reports and every managed department', async () => {
  const filter = await buildManagerEmployeeScope(actor);
  assert.equal(filter.$or[0].managerId, actor.id);
  assert.equal(filter.$or[1].department.$in.length, 2);
  assert.equal(filter.$or[1].department.$in[0].test('Accounting'), true);
  assert.equal(filter.$or[1].department.$in[1].test('operations'), true);
});

test('manager access supports direct managerId and managed department', async () => {
  assert.equal(await managerCanAccessEmployee(actor, {
    managerId: actor.id,
    department: 'sales',
  }), true);
  assert.equal(await managerCanAccessEmployee(actor, {
    managerId: null,
    department: 'OPERATIONS',
  }), true);
  assert.equal(await managerCanAccessEmployee(actor, {
    managerId: null,
    department: 'sales',
  }), false);
});
