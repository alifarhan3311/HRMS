const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { validatePayload } = require('../src/modules/training/training.validation');
const service = require('../src/modules/training/training.service');

const payload = {
  name: 'Call Center',
  summary: 'Customer call handling',
  audience: 'department',
  departments: [' Call Center '],
  blocks: [
    { type: 'heading', text: 'Call quality' },
    { type: 'paragraph', text: 'Use the approved greeting.' },
    { type: 'bullets', text: 'Listen\nConfirm\nResolve' },
  ],
};

test('training content validation normalizes category slug, departments, and lists', () => {
  const result = validatePayload(payload, 'create');
  assert.equal(result.slug, 'call-center');
  assert.deepEqual(result.departments, ['call center']);
  assert.equal(result.blocks[2].text, 'Listen\nConfirm\nResolve');
});

test('training content rejects empty, unsafe, or oversized content', () => {
  for (const input of [
    { ...payload, name: ' ' },
    { ...payload, audience: 'department', departments: [] },
    { ...payload, blocks: [] },
    { ...payload, blocks: [{ type: 'html', text: '<script>alert(1)</script>' }] },
    { ...payload, blocks: [{ type: 'heading', text: 'x'.repeat(201) }] },
  ]) assert.throws(() => validatePayload(input, 'create'), { status: 400 });
});

test('delete payload needs only a revision and does not require training content', () => {
  assert.deepEqual(validatePayload({ revision: 2 }, 'delete'), { revision: 2 });
});

test('only HR and administrator roles may create, update, or remove training tabs', async () => {
  for (const role of ['employee', 'team_lead', 'floor_head', 'manager']) {
    const actor = { role, id: 'user-id', companyId: 'company-id' };
    await assert.rejects(service.create(payload, actor), { status: 403 });
    await assert.rejects(service.change('507f1f77bcf86cd799439011', { ...payload, revision: 1 }, actor), { status: 403 });
    await assert.rejects(service.change('507f1f77bcf86cd799439011', { revision: 1 }, actor, true), { status: 403 });
  }
});
