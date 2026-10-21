const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { validatePayload } = require('../src/modules/training/training.validation');
const service = require('../src/modules/training/training.service');
const TrainingCategory = require('../src/modules/training/training.model');
const Employee = require('../src/modules/employees/employees.model');

const payload = {
  name: 'Call Center',
  summary: 'Customer call handling',
  blocks: [
    { type: 'heading', text: 'Call quality' },
    { type: 'paragraph', text: 'Use the approved greeting.' },
    { type: 'bullets', text: 'Listen\nConfirm\nResolve' },
  ],
};

test('training content validation normalizes category slug and list items', () => {
  const result = validatePayload(payload, 'create');
  assert.equal(result.slug, 'call-center');
  assert.equal(result.blocks[2].text, 'Listen\nConfirm\nResolve');
});

test('training content rejects empty, unsafe, oversized, or caller-selected audience settings', () => {
  for (const input of [
    { ...payload, name: ' ' },
    { ...payload, audience: 'all' },
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

test('non-Call-Center employees are denied training-library access', async t => {
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'pos' ? null : ({ _id: 'atm-id', revision: 1, blocks: [{ type: 'heading', text: 'ATM Rental Model' }, { type: 'heading', text: 'ATM Commission Model' }, { type: 'heading', text: 'ATM Buy' }] }) }) }));
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async () => ({}));
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));
  t.mock.method(Employee, 'findOne', () => ({ select: () => ({ lean: async () => ({ department: 'Accounting' }) }) }));
  await assert.rejects(service.list({ role: 'employee', id: 'employee-id', companyId: 'company-id' }), { status: 403 });
});

test('Call-Center employees can read the training library', async t => {
  const categories = [{ name: 'ATM', audience: 'department', departments: ['call center'] }];
  t.mock.method(TrainingCategory, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: 'atm-id', revision: 1, blocks: [{ type: 'heading', text: 'ATM Rental Model' }, { type: 'heading', text: 'ATM Commission Model' }, { type: 'heading', text: 'ATM Buy' }] }) }) }));
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async () => ({}));
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => categories }) }));
  t.mock.method(Employee, 'findOne', () => ({ select: () => ({ lean: async () => ({ department: 'Call Center' }) }) }));
  assert.deepEqual(await service.list({ role: 'employee', id: 'employee-id', companyId: 'company-id' }), categories);
});

test('ATM rental terms are added once and existing ATM material is preserved', async t => {
  const atm = {
    _id: 'atm-id', revision: 4, summary: 'ATM summary', blocks: [
      { type: 'paragraph', text: 'ATM summary' },
      { type: 'heading', text: 'Training details' },
      { type: 'paragraph', text: 'HR can edit this page to add the training material, process steps, and learning resources.' },
      { type: 'paragraph', text: 'Existing ATM guide' },
    ],
  };
  let migration;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'atm' ? atm : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (filter, update) => { migration = { filter, update }; return {}; });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [atm] }) }));
  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migration.filter.revision, 4);
  assert.deepEqual(migration.update.$set.blocks.map(block => block.text), [
    'Existing ATM guide',
    'ATM Commission Model',
    'The customer pays $4 per transaction.\nIf the owner loads the cash: $2 goes to the owner and $2 goes to us.\nIf we load the cash and handle maintenance: $1 goes to the owner and $3 goes to us.\nIf the owner does not agree to $1, you may offer $1.50 or $1.75.\nThe maximum offer is $1.75 per transaction. Do not go higher if cash flow is low.',
    'ATM Rental Model',
    'The ATM owner pays us fixed monthly rent of $160.\nA $4 surcharge is automatically deducted from the customer for each transaction.\nThe full $4 transaction surcharge goes to the ATM owner.\nOur monthly rent remains $160 regardless of how many transactions take place.',
    'ATM Buy',
    'The owner buys the ATM for $5,000–$6,000.\nThe ATM belongs to the owner.\nAll earnings and expenses are the owner’s responsibility.\nWe receive no share of the owner’s earnings.',
  ]);
  assert.equal(migration.update.$inc.revision, 1);
});

test('POS training is added to the POS tab while preserving HR-authored material', async t => {
  const pos = {
    _id: 'pos-id', revision: 3, summary: 'POS summary', blocks: [
      { type: 'paragraph', text: 'POS summary' },
      { type: 'paragraph', text: 'Existing POS guide' },
    ],
  };
  let migration;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'pos' ? pos : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (filter, update) => { migration = { filter, update }; return {}; });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [pos] }) }));
  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migration.filter.revision, 3);
  const blocks = migration.update.$set.blocks;
  assert.equal(blocks[0].text, 'Existing POS guide');
  assert.deepEqual(blocks.map(block => block.text).slice(1), [
    'POS Types',
    'POS means Point of Sale. There are three types: POS Terminal, POS System, and POS Software.',
    '1. POS Terminal',
    'Wired: Connected by cable.\nWireless: Works without a cable.\nSIM-Based: Uses a SIM card.',
    '2. POS System',
    'A complete checkout system used in stores. It includes a screen, barcode scanner, cash drawer, and other devices.',
    'Example: At Imtiaz Supermarket, the cashier scans items, the system calculates the bill, and the customer pays.',
    '3. POS Software',
    'Software used to manage payments through websites and apps.',
    'Example: Paying online with a Visa or Mastercard.',
    '4. Interchange Rate',
    'Debit Card: 4 cents per transaction.\nCredit Card: 0.29% per transaction.',
    '5. Service Providers',
    'Our Connected Service Providers (Agents)',
    'Global Payments\nMoneris\nElavon (NRS)\nClover (First Data)\nNovia',
    'Competitors (Not Connected With Us)',
    'TD, Chase, and Square are competitors. We are not connected with them.',
  ]);
});
