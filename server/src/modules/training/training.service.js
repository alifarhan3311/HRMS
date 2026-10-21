const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const TrainingCategory = require('./training.model');
const Employee = require('../employees/employees.model');
const employeeService = require('../employees/employees.service');
const { validatePayload } = require('./training.validation');

const MANAGERS = ['hr', 'admin', 'super_admin'];
const STARTER_CATEGORIES = [
  ['atm', 'ATM', 'ATM services, transaction handling, and customer support.'],
  ['pos', 'POS', 'Point-of-sale operations, settlements, and troubleshooting.'],
  ['accounting', 'Accounting', 'Accounting workflows, records, and quality standards.'],
  ['mortgage', 'Mortgage', 'Mortgage process knowledge, documentation, and customer care.'],
  ['digital-media', 'Digital Media', 'Digital channels, content workflows, and campaign basics.'],
  ['insurance', 'Insurance', 'Insurance products, customer guidance, and process compliance.'],
  ['business-loans', 'Business Loans', 'Business lending products, application flow, and documentation.'],
  ['easy-finance', 'Easy Finance', 'Easy Finance products, customer eligibility, and service workflow.'],
  ['call-center', 'Call Center', 'Call handling, service quality, and customer communication.'],
];
const TRAINING_DEPARTMENT = 'call center';
const ATM_RENTAL_BLOCKS = [
  { type: 'heading', text: 'ATM Rental Model' },
  { type: 'bullets', text: [
    'The ATM owner pays us fixed monthly rent of $160.',
    'A $4 surcharge is automatically deducted from the customer for each transaction.',
    'The full $4 transaction surcharge goes to the ATM owner.',
    'Our monthly rent remains $160 regardless of how many transactions take place.',
  ].join('\n') },
];
const ATM_COMMISSION_BLOCKS = [
  { type: 'heading', text: 'ATM Commission Model' },
  { type: 'bullets', text: [
    'The customer pays $4 per transaction.',
    'If the owner loads the cash: $2 goes to the owner and $2 goes to us.',
    'If we load the cash and handle maintenance: $1 goes to the owner and $3 goes to us.',
    'If the owner does not agree to $1, you may offer $1.50 or $1.75.',
    'The maximum offer is $1.75 per transaction. Do not go higher if cash flow is low.',
  ].join('\n') },
];
const ATM_BUY_BLOCKS = [
  { type: 'heading', text: 'ATM Buy' },
  { type: 'bullets', text: [
    'The owner buys the ATM for $5,000–$6,000.',
    'The ATM belongs to the owner.',
    'All earnings and expenses are the owner’s responsibility.',
    'We receive no share of the owner’s earnings.',
  ].join('\n') },
];
const POS_TRAINING_BLOCKS = [
  { type: 'heading', text: 'POS Types' },
  { type: 'paragraph', text: 'POS means Point of Sale. There are three types: POS Terminal, POS System, and POS Software.' },
  { type: 'heading', text: '1. POS Terminal' },
  { type: 'bullets', text: [
    'Wired: Connected by cable.',
    'Wireless: Works without a cable.',
    'SIM-Based: Uses a SIM card.',
  ].join('\n') },
  { type: 'heading', text: '2. POS System' },
  { type: 'paragraph', text: 'A complete checkout system used in stores. It includes a screen, barcode scanner, cash drawer, and other devices.' },
  { type: 'paragraph', text: 'Example: At Imtiaz Supermarket, the cashier scans items, the system calculates the bill, and the customer pays.' },
  { type: 'heading', text: '3. POS Software' },
  { type: 'paragraph', text: 'Software used to manage payments through websites and apps.' },
  { type: 'paragraph', text: 'Example: Paying online with a Visa or Mastercard.' },
  { type: 'heading', text: '4. Interchange Rate' },
  { type: 'bullets', text: 'Debit Card: 4 cents per transaction.\nCredit Card: 0.29% per transaction.' },
  { type: 'heading', text: '5. Service Providers' },
  { type: 'heading', text: 'Our Connected Service Providers (Agents)' },
  { type: 'bullets', text: 'Global Payments\nMoneris\nElavon (NRS)\nClover (First Data)\nNovia' },
  { type: 'heading', text: 'Competitors (Not Connected With Us)' },
  { type: 'paragraph', text: 'TD, Chase, and Square are competitors. We are not connected with them.' },
];
const POS_PREVIOUS_BLOCKS = [
  { type: 'heading', text: 'POS Types' },
  { type: 'paragraph', text: 'POS means Point of Sale. There are three types: POS Terminal, POS System, and POS Software.' },
  { type: 'heading', text: '1. POS Terminal Types' },
  { type: 'bullets', text: 'Wired: Connected by cable.\nWireless: Works without a cable.\nSIM-Based: Uses a SIM card.' },
  { type: 'heading', text: '2. POS System' },
  { type: 'paragraph', text: 'A complete checkout system used in stores. It includes a screen, barcode scanner, cash drawer, and other devices. It helps scan products, calculate bills, and process payments.' },
  { type: 'paragraph', text: 'Example: At Imtiaz Supermarket, the cashier scans the items, the system calculates the total bill, and the customer pays at the checkout counter. This setup is called a POS System.' },
  { type: 'heading', text: '3. POS Software' },
  { type: 'paragraph', text: 'POS software helps businesses accept and manage online payments through websites or apps.' },
  { type: 'paragraph', text: 'Example: When shopping online and paying using a Visa or Mastercard, the website uses an online payment system to process the payment.' },
];

function requireCompany(actor) {
  if (!actor?.companyId) throw createHttpError(403, 'Company access is required.');
}
function requireManager(actor) {
  if (!MANAGERS.includes(actor?.role)) throw createHttpError(403, 'Only HR or an administrator can manage training categories.');
}
function normalizeDepartment(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return normalized === 'callcentre' ? 'callcenter' : normalized;
}
function scope(actor) {
  requireCompany(actor);
  return { companyId: actor.companyId, deletedAt: null };
}
function target(id, actor) {
  if (!mongoose.isObjectIdOrHexString(id)) throw createHttpError(400, 'Invalid training category ID.');
  return { ...scope(actor), _id: id };
}

async function seedStarterCategories(actor) {
  if (await TrainingCategory.exists({ companyId: actor.companyId })) return;
  const records = STARTER_CATEGORIES.map(([slug, name, summary]) => ({
    companyId: actor.companyId,
    name,
    slug,
    summary,
    agentCommission: slug === 'atm' ? 5000 : null,
    atmCompany: slug === 'atm' ? 'Hyosung' : '',
    audience: 'department',
    departments: [TRAINING_DEPARTMENT],
    // Starter pages should not imply that placeholder text is real training
    // material. ATM has the actual business terms supplied by HR.
    blocks: slug === 'atm' ? [...ATM_COMMISSION_BLOCKS, ...ATM_RENTAL_BLOCKS, ...ATM_BUY_BLOCKS] : [{ type: 'paragraph', text: summary }],
    createdBy: actor.id,
    updatedBy: actor.id,
  }));
  try {
    await TrainingCategory.insertMany(records, { ordered: false });
  } catch (error) {
    // A concurrent first visit can race the starter-category initialization.
    if (error.code !== 11000 && !error.writeErrors?.every(item => item.code === 11000)) throw error;
  }
}

async function list(actor) {
  const base = scope(actor);
  await seedStarterCategories(actor);
  // Enforce the clarified module-wide policy for any tabs created before this
  // restriction: every active training category belongs to Call Center only.
  await TrainingCategory.updateMany({
    ...base,
    $or: [
      { audience: { $ne: 'department' } },
      { departments: { $ne: [TRAINING_DEPARTMENT] } },
    ],
  }, {
    $set: { audience: 'department', departments: [TRAINING_DEPARTMENT] },
    $inc: { revision: 1 },
  });
  // Remove seeded placeholder copy from the ATM page, preserve actual HR
  // material, and ensure the approved rental and commission terms are present.
  const atmCategory = await TrainingCategory.findOne({ ...base, slug: 'atm' })
    .select('_id blocks revision summary agentCommission atmCompany').lean();
  if (atmCategory) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const blocks = (atmCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === atmCategory.summary)) return false;
      return true;
    });
    const sectionBlocks = {
      'ATM Commission Model': ATM_COMMISSION_BLOCKS,
      'ATM Rental Model': ATM_RENTAL_BLOCKS,
      'ATM Buy': ATM_BUY_BLOCKS,
    };
    const sectionHeadings = Object.keys(sectionBlocks);
    const authoredBlocks = blocks.filter(block => !(block.type === 'heading' && sectionHeadings.includes(block.text))
      && !(block.type === 'bullets' && Object.values(sectionBlocks).some(section => section[1].text === block.text)));
    // Put the three managed ATM business models in the requested order while
    // retaining any separate material HR has authored before or after them.
    const nextBlocks = [
      ...authoredBlocks,
      ...ATM_COMMISSION_BLOCKS,
      ...ATM_RENTAL_BLOCKS,
      ...ATM_BUY_BLOCKS,
    ];
    const changed = nextBlocks.length !== (atmCategory.blocks || []).length
      || nextBlocks.some((block, index) => block.type !== atmCategory.blocks[index]?.type || block.text !== atmCategory.blocks[index]?.text);
    const companyNameMissing = !String(atmCategory.atmCompany || '').trim();
    const commissionMissing = atmCategory.agentCommission == null;
    if (changed || companyNameMissing || commissionMissing) {
      await TrainingCategory.findOneAndUpdate({
        _id: atmCategory._id,
        companyId: actor.companyId,
        deletedAt: null,
        revision: atmCategory.revision,
      }, {
        $set: {
          blocks: nextBlocks,
          ...(companyNameMissing ? { atmCompany: 'Hyosung' } : {}),
          ...(commissionMissing ? { agentCommission: 5000 } : {}),
        },
        $inc: { revision: 1 },
      }, { new: true, runValidators: true });
    }
  }
  // Add the approved POS primer to the existing POS tab without replacing any
  // training material HR has already written there.
  const posCategory = await TrainingCategory.findOne({ ...base, slug: 'pos' })
    .select('_id blocks revision summary').lean();
  if (posCategory) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (posCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === posCategory.summary)) return false;
      return true;
    });
    const managedPosBlocks = [...POS_PREVIOUS_BLOCKS, ...POS_TRAINING_BLOCKS];
    const authoredBlocks = existingBlocks.filter(block => !(block.type === 'heading' && managedPosBlocks.some(posBlock => posBlock.type === 'heading' && posBlock.text === block.text))
      && !managedPosBlocks.some(posBlock => posBlock.type === block.type && posBlock.text === block.text));
    const nextBlocks = [...authoredBlocks, ...POS_TRAINING_BLOCKS];
    const changed = nextBlocks.length !== (posCategory.blocks || []).length
      || nextBlocks.some((block, index) => block.type !== posCategory.blocks[index]?.type || block.text !== posCategory.blocks[index]?.text);
    if (changed) {
      await TrainingCategory.findOneAndUpdate({
        _id: posCategory._id,
        companyId: actor.companyId,
        deletedAt: null,
        revision: posCategory.revision,
      }, {
        $set: { blocks: nextBlocks },
        $inc: { revision: 1 },
      }, { new: true, runValidators: true });
    }
  }
  const categories = await TrainingCategory.find(base).sort({ name: 1, _id: 1 }).lean();
  // Commission values are private HR data; never expose them through the
  // training-library response to employees, managers, admins, or super-admins.
  if (actor.role !== 'hr') {
    for (const category of categories) delete category.agentCommission;
  }
  if (MANAGERS.includes(actor.role)) return categories;
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId }).select('department').lean();
  const department = normalizeDepartment(employee?.department);
  if (department !== 'callcenter') throw createHttpError(403, 'Training is available only to Call Center employees.');
  return categories;
}

async function create(payload, actor) {
  requireManager(actor);
  const data = validatePayload(payload, 'create');
  if (await TrainingCategory.exists({ companyId: actor.companyId, slug: data.slug, deletedAt: null })) {
    throw createHttpError(409, 'A training tab with this name already exists.');
  }
  return TrainingCategory.create({
    ...data,
    ...(data.slug === 'atm' ? { agentCommission: data.agentCommission ?? 5000, atmCompany: data.atmCompany || 'Hyosung' } : {}),
    audience: 'department', departments: [TRAINING_DEPARTMENT], ...scope(actor), createdBy: actor.id, updatedBy: actor.id,
  });
}

async function change(id, payload, actor, remove = false) {
  requireManager(actor);
  const { revision, ...validated } = validatePayload(payload, remove ? 'delete' : 'update');
  const filter = { ...target(id, actor), revision };
  let data = validated;
  if (!remove) {
    if (await TrainingCategory.exists({ ...scope(actor), slug: data.slug, _id: { $ne: id } })) {
      throw createHttpError(409, 'A training tab with this name already exists.');
    }
  }
  const record = await TrainingCategory.findOneAndUpdate(filter, {
    $set: { ...(remove ? { deletedAt: new Date() } : { ...data, audience: 'department', departments: [TRAINING_DEPARTMENT] }), updatedBy: actor.id },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await TrainingCategory.exists(target(id, actor))) throw createHttpError(404, 'Training category not found.');
    throw createHttpError(409, 'This training page changed. Reopen the latest version before saving.');
  }
  return record;
}

module.exports = { list, create, change };
