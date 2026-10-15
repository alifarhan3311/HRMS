const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePayload } = require('../src/modules/rules/rules.validation');
const service = require('../src/modules/rules/rules.service');
const Rule = require('../src/modules/rules/rules.model');
const hr = { role: 'hr', id: 'hr-one', companyId: 'company-one' };
const id = '507f1f77bcf86cd799439011';
const payload = { title: 'Workplace guidance', summary: 'Introduction', blocks: [{ type: 'heading', text: 'Respect' }, { type: 'paragraph', text: 'Be considerate.' }, { type: 'bullets', text: ' Item one\r\n\n Item two ' }, { type: 'numbered', text: 'First\nSecond' }] };

test('validates structured content and normalizes list items', () => {
  const result = validatePayload(payload, 'create');
  assert.equal(result.blocks[2].text, 'Item one\nItem two');
  assert.equal(result.blocks[3].type, 'numbered');
});
test('rejects empty, oversized, unknown block types and unauthorized fields', () => {
  for (const data of [
    undefined,
    { ...payload, title: ' ' }, { ...payload, blocks: [] },
    { ...payload, companyId: 'other-company' },
    { ...payload, blocks: [{ type: 'html', text: '<script>bad()</script>' }] },
    { ...payload, blocks: [{ type: 'heading', text: 'a'.repeat(201) }] },
    { ...payload, blocks: [{ type: 'bullets', text: Array(51).fill('Item').join('\n') }] },
  ]) assert.throws(() => validatePayload(data, 'create'), { status: 400 });
});
test('only HR can add, update or delete; admin and super admin are also read-only', async () => {
  for (const role of ['employee', 'team_lead', 'floor_head', 'manager', 'admin', 'super_admin']) {
    const actor = { ...hr, role };
    await assert.rejects(service.create(payload, actor), { status: 403 });
    await assert.rejects(service.change(id, { ...payload, revision: 1 }, actor), { status: 403 });
    await assert.rejects(service.change(id, { revision: 1 }, actor, true), { status: 403 });
  }
});
test('list only reads active rules belonging to the actor company', async t => {
  let filter;
  t.mock.method(Rule, 'find', value => { filter = value; return { sort: () => ({ lean: async () => [] }) }; });
  assert.deepEqual(await service.list({ ...hr, role: 'employee' }), []);
  assert.deepEqual(filter, { companyId: hr.companyId, deletedAt: null });
  await assert.rejects(service.list({ role: 'hr' }), { status: 403 });
});
test('create stamps ownership from authenticated user', async t => {
  const mock = t.mock.method(Rule, 'create', async data => data);
  const result = await service.create(payload, hr);
  assert.equal(result.companyId, hr.companyId);
  assert.equal(result.createdBy, hr.id);
  assert.equal(result.updatedBy, hr.id);
  assert.equal(mock.mock.callCount(), 1);
});
test('updates are tenant-scoped and revision-checked', async t => {
  let filter; let update;
  t.mock.method(Rule, 'findOneAndUpdate', async (f, u) => { filter = f; update = u; return { _id: id }; });
  await service.change(id, { ...payload, revision: 3 }, hr);
  assert.deepEqual(filter, { _id: id, companyId: hr.companyId, deletedAt: null, revision: 3 });
  assert.equal(update.$set.title, payload.title);
  assert.equal(update.$inc.revision, 1);
});
test('deletion archives only the selected current revision', async t => {
  let update;
  t.mock.method(Rule, 'findOneAndUpdate', async (filter, value) => { update = value; assert.equal(filter._id, id); assert.equal(filter.companyId, hr.companyId); return {}; });
  await service.change(id, { revision: 2 }, hr, true);
  assert.ok(update.$set.deletedAt instanceof Date);
  assert.equal(update.$set.updatedBy, hr.id);
});
test('stale edits conflict and missing/cross-company records return not found', async t => {
  t.mock.method(Rule, 'findOneAndUpdate', async () => null);
  const exists = t.mock.method(Rule, 'exists', async () => ({ _id: id }));
  await assert.rejects(service.change(id, { ...payload, revision: 1 }, hr), { status: 409 });
  exists.mock.mockImplementation(async () => null);
  await assert.rejects(service.change(id, { revision: 1 }, hr, true), { status: 404 });
  await assert.rejects(service.change('invalid', { revision: 1 }, hr, true), { status: 400 });
});
