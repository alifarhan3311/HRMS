const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/modules/auth/auth.service');
const repository = require('../src/modules/auth/auth.repository');
const Session = require('../src/modules/auth/auth.model');

const actorId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const sessionId = '507f1f77bcf86cd799439013';
const currentSessionId = '507f1f77bcf86cd799439014';
const actor = { id: actorId, role: 'hr', companyId: 'company-one' };
const activeSession = () => ({
  _id: sessionId, employeeId: actorId, companyId: actor.companyId,
  revoked: false, expiresAt: new Date(Date.now() + 60000),
});

test('HR and Admin list only their own sessions, ignoring caller-selected owners', async t => {
  const calls = [];
  t.mock.method(repository, 'findAll', async options => {
    calls.push(options);
    return { items: [], total: 0 };
  });
  for (const role of ['hr', 'admin']) {
    await service.listSessions({ employeeId: otherId, companyId: 'other-company' }, { ...actor, role });
  }
  for (const { filter } of calls) {
    assert.equal(filter.employeeId, actorId);
    assert.equal(filter.revoked, false);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.deepEqual(filter.$or, [{ companyId: actor.companyId }, { companyId: { $exists: false } }]);
  }
});

test('other roles cannot list or revoke sessions, including super admin', async () => {
  for (const role of ['employee', 'team_lead', 'floor_head', 'manager', 'super_admin']) {
    await assert.rejects(service.listSessions({}, { ...actor, role }), { status: 403 });
    await assert.rejects(service.revokeSession(sessionId, { ...actor, role }, currentSessionId), { status: 403 });
  }
  await assert.rejects(service.listSessions({}, {}), { status: 403 });
});

test('another account session cannot be revoked even in the same company', async t => {
  t.mock.method(repository, 'findById', async () => ({ ...activeSession(), employeeId: otherId }));
  const revoke = t.mock.method(repository, 'revokeActiveById', async () => ({}));
  await assert.rejects(service.revokeSession(sessionId, actor, currentSessionId), { status: 404 });
  assert.equal(revoke.mock.callCount(), 0);
});

test('own cross-company session cannot be revoked', async t => {
  t.mock.method(repository, 'findById', async () => ({ ...activeSession(), companyId: 'company-two' }));
  await assert.rejects(service.revokeSession(sessionId, actor, currentSessionId), { status: 404 });
});

test('HR and Admin can revoke their own remote sessions including legacy sessions', async t => {
  const session = activeSession();
  t.mock.method(repository, 'findById', async () => session);
  const revoke = t.mock.method(repository, 'revokeActiveById', async () => ({ _id: sessionId }));
  await service.revokeSession(sessionId, actor, currentSessionId);
  delete session.companyId;
  await service.revokeSession(sessionId, { ...actor, role: 'admin' }, currentSessionId);
  for (const call of revoke.mock.calls) assert.deepEqual(call.arguments, [sessionId, actorId]);
});

test('current device and expired sessions cannot be remotely revoked', async t => {
  await assert.rejects(service.revokeSession(currentSessionId, actor, currentSessionId), { status: 400 });
  t.mock.method(repository, 'findById', async () => ({ ...activeSession(), expiresAt: new Date(0) }));
  await assert.rejects(service.revokeSession(sessionId, actor, currentSessionId), { status: 404 });
});

test('atomic revoke write also requires session ownership and an active session', async t => {
  let filter;
  t.mock.method(Session, 'findOneAndUpdate', value => {
    filter = value;
    return { select: async () => ({ _id: sessionId }) };
  });
  await repository.revokeActiveById(sessionId, actorId);
  assert.equal(filter._id, sessionId);
  assert.equal(filter.employeeId, actorId);
  assert.equal(filter.revoked, false);
  assert.ok(filter.expiresAt.$gt instanceof Date);
});
