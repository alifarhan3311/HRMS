const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCommission } = require('../src/modules/training/commission.validation');
const commissionService = require('../src/modules/training/commission.service');
const TrainingCommission = require('../src/modules/training/commission.model');

test('commission validation supports fixed PKR and percentage values', () => {
  assert.deepEqual(validateCommission({ name: 'Digital Media', amount: 10, unit: 'percent' }, 'create'), {
    name: 'Digital Media', amount: 10, unit: 'percent', slug: 'digital-media',
  });
  assert.throws(() => validateCommission({ name: 'Digital Media', amount: -1, unit: 'percent' }, 'create'), { status: 400 });
  assert.throws(() => validateCommission({ name: 'Digital Media', amount: 10, unit: 'USD' }, 'create'), { status: 400 });
});

test('commission write operations are HR-only', async () => {
  const companyId = '507f191e810c19729de860ea';
  const actor = { role: 'admin', id: '507f1f77bcf86cd799439011', companyId };
  await assert.rejects(commissionService.list(actor), { status: 403 });
  await assert.rejects(commissionService.create({ name: 'Other', amount: 20, unit: 'PKR' }, actor), { status: 403 });
});

test('commission records can be created by HR', async t => {
  const companyId = '507f191e810c19729de860ea';
  const id = '507f1f77bcf86cd799439011';
  t.mock.method(TrainingCommission, 'exists', async () => false);
  t.mock.method(TrainingCommission, 'create', async data => data);
  const result = await commissionService.create({ name: 'Digital Media', amount: 10, unit: 'percent' }, { role: 'hr', id, companyId });
  assert.equal(result.slug, 'digital-media');
  assert.equal(result.amount, 10);
  assert.equal(result.unit, 'percent');
});
