const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const { buildApprovalChain, stageOneRoleAllowed } = require('../src/modules/leaves/leaves.service');

test('sick leave requires Manager approval before HR final approval', () => {
  const chain = buildApprovalChain('sick');
  assert.deepEqual(chain.map(step => [step.stage, step.approverRole]), [
    [1, 'manager'],
    [2, 'hr'],
  ]);
  assert.equal(stageOneRoleAllowed('sick', 'manager'), true);
  assert.equal(stageOneRoleAllowed('sick', 'team_lead'), false);
  assert.equal(stageOneRoleAllowed('sick', 'floor_head'), false);
});

test('annual leave accepts either Team Lead or Manager before HR final approval', () => {
  const chain = buildApprovalChain('annual');
  assert.deepEqual(chain.map(step => [step.stage, step.approverRole]), [
    [1, 'team_lead/manager'],
    [2, 'hr'],
  ]);
  assert.equal(stageOneRoleAllowed('annual', 'team_lead'), true);
  assert.equal(stageOneRoleAllowed('annual', 'manager'), true);
  assert.equal(stageOneRoleAllowed('annual', 'floor_head'), false);
});
