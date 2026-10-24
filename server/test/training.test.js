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
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'atm' ? ({ _id: 'atm-id', revision: 1, blocks: [{ type: 'heading', text: 'ATM Rental Model' }, { type: 'heading', text: 'ATM Commission Model' }, { type: 'heading', text: 'ATM Buy' }] }) : null }) }));
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async () => ({}));
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));
  t.mock.method(Employee, 'findOne', () => ({ select: () => ({ lean: async () => ({ department: 'Accounting' }) }) }));
  await assert.rejects(service.list({ role: 'employee', id: 'employee-id', companyId: 'company-id' }), { status: 403 });
});

test('Call-Center employees can read the training library', async t => {
  const categories = [{ name: 'ATM', audience: 'department', departments: ['call center'] }];
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'atm' ? ({ _id: 'atm-id', revision: 1, blocks: [{ type: 'heading', text: 'ATM Rental Model' }, { type: 'heading', text: 'ATM Commission Model' }, { type: 'heading', text: 'ATM Buy' }] }) : null }) }));
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
    _id: 'pos-id', revision: 3, posContentVersion: 0, summary: 'POS summary', blocks: [
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
  assert.equal(migration.update.$set.posContentVersion, 1);
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

test('POS migration keeps HR-edited interchange rate and removes legacy duplicates once', async t => {
  const pos = {
    _id: 'pos-id', revision: 8, posContentVersion: 0, summary: 'POS summary', blocks: [
      { type: 'bullets', text: 'Debit Card: 5 cents per transaction.\nCredit Card: 0.29% per transaction.' },
      { type: 'bullets', text: 'Debit Card: 5 cents per transaction.\nCredit Card: 0.29% per transaction.' },
      { type: 'heading', text: '4. Interchange Rate' },
      { type: 'bullets', text: 'Debit Card: 4 cents per transaction.\nCredit Card: 0.29% per transaction.' },
    ],
  };
  let migrations = 0;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'pos' ? pos : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (_filter, update) => {
    migrations += 1;
    pos.blocks = update.$set.blocks;
    pos.posContentVersion = update.$set.posContentVersion;
    pos.revision += update.$inc.revision;
    return {};
  });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [pos] }) }));

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  const rateBlocks = pos.blocks.filter(block => block.type === 'bullets' && /Debit Card:|Credit Card:/.test(block.text));
  assert.equal(rateBlocks.length, 1);
  assert.equal(rateBlocks[0].text, 'Debit Card: 5 cents per transaction.\nCredit Card: 0.29% per transaction.');
  assert.equal(pos.blocks.filter(block => block.type === 'heading' && block.text === '4. Interchange Rate').length, 1);

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migrations, 1, 'subsequent page loads should not rewrite migrated HR content');
});

test('insurance primer is added once while preserving HR-authored material', async t => {
  const insurance = {
    _id: 'insurance-id', revision: 2, insuranceContentVersion: 2,
    summary: 'Insurance products, customer guidance, and process compliance.',
    blocks: [
      { type: 'paragraph', text: 'Insurance products, customer guidance, and process compliance.' },
      { type: 'paragraph', text: 'Existing insurance notes' },
    ],
  };
  let migrations = 0;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'insurance' ? insurance : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (_filter, update) => {
    migrations += 1;
    insurance.blocks = update.$set.blocks;
    insurance.insuranceContentVersion = update.$set.insuranceContentVersion;
    insurance.revision += update.$inc.revision;
    return {};
  });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [insurance] }) }));

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(insurance.blocks[0].text, 'Existing insurance notes');
  assert.ok(insurance.blocks.some(block => block.text === 'Life Insurance'));
  assert.ok(insurance.blocks.some(block => block.text.includes('Mortgage Insurance:') || block.text === 'Mortgage Insurance'));
  assert.ok(insurance.blocks.some(block => block.text === 'Coverage depends on the insurance policy.'));
  assert.ok(!insurance.blocks.some(block => block.text.includes('Insurance is financial protection.')));
  assert.equal(insurance.blocks.filter(block => block.text === 'Insurance Training – 7 Types').length, 1);
  assert.equal(insurance.insuranceContentVersion, 3);

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migrations, 1, 'subsequent page loads should not duplicate the insurance primer');
});

test('business-loan training is added once while preserving HR-authored material', async t => {
  const category = {
    _id: 'business-loans-id', revision: 1, businessLoansContentVersion: 0,
    summary: 'Business lending products, application flow, and documentation.',
    blocks: [{ type: 'paragraph', text: 'Existing lending notes' }],
  };
  let migrations = 0;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'business-loans' ? category : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (_filter, update) => {
    migrations += 1;
    category.blocks = update.$set.blocks;
    category.businessLoansContentVersion = update.$set.businessLoansContentVersion;
    category.revision += update.$inc.revision;
    return {};
  });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [category] }) }));

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(category.blocks[0].text, 'Existing lending notes');
  assert.ok(category.blocks.some(block => block.text.includes('Credit Score: The client should have a credit score of at least 700.')));
  assert.ok(category.blocks.some(block => block.text.includes('We cannot confirm the exact amount in advance.')));
  assert.equal(category.businessLoansContentVersion, 1);

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migrations, 1, 'subsequent page loads should not duplicate the business-loan guide');
});

test('accounting fresher guide is added once while preserving HR-authored material', async t => {
  const category = {
    _id: 'accounting-id', revision: 1, accountingContentVersion: 0,
    summary: 'Accounting workflows, records, and quality standards.',
    blocks: [{ type: 'paragraph', text: 'Existing accounting notes' }],
  };
  let migrations = 0;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'accounting' ? category : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (_filter, update) => {
    migrations += 1;
    category.blocks = update.$set.blocks;
    category.accountingContentVersion = update.$set.accountingContentVersion;
    category.revision += update.$inc.revision;
    return {};
  });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [category] }) }));

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(category.blocks[0].text, 'Existing accounting notes');
  assert.ok(category.blocks.some(block => block.text.includes('Personal Tax (T1):')));
  assert.ok(category.blocks.some(block => block.text.includes('Tax Slip: A document that shows income received during the year.')));
  assert.equal(category.accountingContentVersion, 1);

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migrations, 1, 'subsequent page loads should not duplicate the accounting guide');
});

test('Canadian business targeting guide is added to Digital Media once and preserves HR content', async t => {
  const category = {
    _id: 'digital-media-id', revision: 3, digitalMediaContentVersion: 0,
    summary: 'Digital channels, content workflows, and campaign basics.',
    blocks: [
      { type: 'paragraph', text: 'Digital channels, content workflows, and campaign basics.' },
      { type: 'paragraph', text: 'Existing HR campaign notes' },
      { type: 'heading', text: 'Training details' },
      { type: 'paragraph', text: 'HR can edit this page to add the training material, process steps, and learning resources.' },
    ],
  };
  let migrations = 0;
  t.mock.method(TrainingCategory, 'exists', async () => true);
  t.mock.method(TrainingCategory, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(TrainingCategory, 'findOne', query => ({ select: () => ({ lean: async () => query.slug === 'digital-media' ? category : null }) }));
  t.mock.method(TrainingCategory, 'findOneAndUpdate', async (_filter, update) => {
    migrations += 1;
    category.blocks = update.$set.blocks;
    category.digitalMediaContentVersion = update.$set.digitalMediaContentVersion;
    category.revision += update.$inc.revision;
    return {};
  });
  t.mock.method(TrainingCategory, 'find', () => ({ sort: () => ({ lean: async () => [category] }) }));

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(category.blocks[0].text, 'Existing HR campaign notes');
  assert.ok(category.blocks.some(block => block.text.includes('Canadian Business Targeting')));
  assert.ok(category.blocks.some(block => block.text.includes('Agentic AI Solutions')));
  assert.ok(category.blocks.some(block => block.text.includes('Cleaning and Home Services')));
  assert.ok(category.blocks.some(block => block.text.includes('book a consultation')));
  assert.equal(category.digitalMediaContentVersion, 1);

  await service.list({ role: 'hr', id: 'hr-id', companyId: 'company-id' });
  assert.equal(migrations, 1, 'subsequent page loads should not duplicate the guide');
});
