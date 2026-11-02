const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const service = require('../src/modules/payroll/payroll.service');
const repository = require('../src/modules/payroll/payroll.repository');
const Payslip = require('../src/modules/payroll/payroll.model');
const Archive = require('../src/modules/payroll/payrollArchive.model');

const actor = { id: 'hr-one', companyId: 'company-one', role: 'hr' };
const payload = { month: 10, year: 2026, confirmation: 'CLEAR 2026-10' };

test('only HR and Admin can clear payroll', async t => {
  const clear = t.mock.method(repository, 'clearPeriodWithArchive', async () => ({ clearedCount: 2 }));
  for (const role of ['employee', 'team_lead', 'floor_head', 'manager', 'super_admin']) {
    await assert.rejects(service.clearPayrollPeriod(payload, { ...actor, role }), { status: 403 });
  }
  await assert.rejects(service.clearPayrollPeriod(payload, { role: 'hr' }), { status: 403 });
  assert.equal(clear.mock.callCount(), 0);
  for (const role of ['hr', 'admin']) await service.clearPayrollPeriod(payload, { ...actor, role });
  assert.equal(clear.mock.callCount(), 2);
});

test('clear requires one explicit valid period, exact confirmation and no caller-selected tenant', async t => {
  const clear = t.mock.method(repository, 'clearPeriodWithArchive', async () => ({}));
  for (const input of [undefined, {}, { ...payload, month: 0 }, { ...payload, month: 13 },
    { ...payload, month: '10' }, { ...payload, year: 1999 }, { ...payload, year: 2101 },
    { ...payload, year: 2026.5 }, { ...payload, month: null }, { ...payload, confirmation: 'CLEAR 2026-11' },
    { ...payload, companyId: 'other-company' }, { ...payload, status: 'approved' }]) {
    await assert.rejects(service.clearPayrollPeriod(input, actor), { status: 400 });
  }
  assert.equal(clear.mock.callCount(), 0);
});

test('clear is scoped to authenticated company and selected month, not to a page or status', async t => {
  const clear = t.mock.method(repository, 'clearPeriodWithArchive', async () => ({ clearedCount: 12, archiveBatchId: 'backup-one' }));
  const result = await service.clearPayrollPeriod(payload, actor);
  assert.deepEqual(clear.mock.calls[0].arguments, [{ companyId: actor.companyId, month: 10, year: 2026 }, actor.id]);
  assert.deepEqual(result, { clearedCount: 12, archiveBatchId: 'backup-one', month: 10, year: 2026 });
});

function mockArchive(t, records) {
  const session = {};
  t.mock.method(Payslip.db, 'transaction', async callback => callback(session));
  const find = t.mock.method(Payslip, 'find', filter => ({ session: supplied => {
    assert.equal(supplied, session);
    return { lean: async () => records };
  } }));
  const archive = t.mock.method(Archive, 'insertMany', async (documents, options) => {
    assert.equal(options.session, session);
    return documents;
  });
  const remove = t.mock.method(Payslip, 'deleteMany', () => ({ session: async supplied => {
    assert.equal(supplied, session);
    return { deletedCount: records.length };
  } }));
  return { find, archive, remove };
}

test('raw encrypted snapshots of all statuses are archived before exact-ID deletion', async t => {
  const records = ['draft', 'approved', 'paid', 'locked'].map((status, index) => ({
    _id: `payslip-${index}`, status, basicSalary: 'original-encrypted-salary', netSalary: 'original-encrypted-net',
  }));
  const { find, archive, remove } = mockArchive(t, records);
  const filter = { companyId: actor.companyId, month: 10, year: 2026 };
  const result = await repository.clearPeriodWithArchive(filter, actor.id);
  assert.equal(result.clearedCount, 4);
  assert.ok(result.archiveBatchId);
  assert.deepEqual(find.mock.calls[0].arguments, [filter]);
  const documents = archive.mock.calls[0].arguments[0];
  assert.equal(documents[0].snapshot, records[0]);
  assert.equal(documents[0].snapshot.basicSalary, 'original-encrypted-salary');
  assert.equal(documents[0].clearedBy, actor.id);
  assert.ok(documents[0].clearedAt instanceof Date);
  assert.deepEqual(remove.mock.calls[0].arguments, [{ ...filter, _id: { $in: records.map(record => record._id) } }]);
});

test('archive failure prevents deletion', async t => {
  const { archive, remove } = mockArchive(t, [{ _id: 'one' }]);
  archive.mock.mockImplementation(async () => { throw new Error('Backup unavailable'); });
  await assert.rejects(repository.clearPeriodWithArchive({ companyId: actor.companyId, month: 10, year: 2026 }, actor.id), /Backup unavailable/);
  assert.equal(remove.mock.callCount(), 0);
});

test('empty period does not write an archive or delete anything', async t => {
  const { archive, remove } = mockArchive(t, []);
  assert.deepEqual(await repository.clearPeriodWithArchive({ companyId: actor.companyId, month: 10, year: 2026 }, actor.id), { clearedCount: 0, archiveBatchId: null });
  assert.equal(archive.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
});

test('count mismatch throws so the transaction rolls back instead of committing a partial clear', async t => {
  const { remove } = mockArchive(t, [{ _id: 'one' }, { _id: 'two' }]);
  remove.mock.mockImplementation(() => ({ session: async () => ({ deletedCount: 1 }) }));
  await assert.rejects(repository.clearPeriodWithArchive({ companyId: actor.companyId, month: 10, year: 2026 }, actor.id), { status: 409 });
});
