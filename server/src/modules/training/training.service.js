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
const INSURANCE_TRAINING_BLOCKS = [
  { type: 'heading', text: 'Insurance Training – 7 Types' },
  { type: 'heading', text: 'Life Insurance' },
  { type: 'paragraph', text: 'Gives financial support to your family.' },
  { type: 'paragraph', text: 'Example: If a parent passes away, the family may receive money.' },
  { type: 'heading', text: 'Health Insurance' },
  { type: 'paragraph', text: 'Helps pay medical bills.' },
  { type: 'paragraph', text: 'Example: Helps pay hospital expenses.' },
  { type: 'heading', text: 'Auto Insurance' },
  { type: 'paragraph', text: 'Covers certain car damages.' },
  { type: 'paragraph', text: 'Example: Helps pay for car repairs after an accident.' },
  { type: 'heading', text: 'Home Insurance' },
  { type: 'paragraph', text: 'Protects your home.' },
  { type: 'paragraph', text: 'Example: Helps pay for fire damage to your house.' },
  { type: 'heading', text: 'Business Insurance' },
  { type: 'paragraph', text: 'Protects a business from certain losses.' },
  { type: 'paragraph', text: 'Example: Helps cover damage to a shop after a fire.' },
  { type: 'heading', text: 'Travel Insurance' },
  { type: 'paragraph', text: 'Helps with problems during a trip.' },
  { type: 'paragraph', text: 'Example: Helps pay medical costs during travel.' },
  { type: 'heading', text: 'Mortgage Insurance' },
  { type: 'paragraph', text: 'Helps protect against certain mortgage risks.' },
  { type: 'paragraph', text: 'Example: Some policies help protect the lender if the borrower cannot repay the mortgage.' },
  { type: 'heading', text: 'Note' },
  { type: 'paragraph', text: 'Coverage depends on the insurance policy.' },
];
const INSURANCE_PREVIOUS_BLOCKS = [
  { type: 'heading', text: 'Insurance – Basic Training' },
  { type: 'heading', text: '1. Insurance kya hoti hai?' },
  { type: 'paragraph', text: 'Insurance ek financial protection hai. Customer premium pay karta hai, aur policy ki conditions ke mutabiq accident, illness, death ya kisi covered loss ki surat mein financial benefit mil sakta hai.' },
  { type: 'heading', text: '2. Insurance ki main types' },
  { type: 'numbered', text: 'Life Insurance: Death ki surat mein family ko financial protection deti hai.\nHealth Insurance: Medical aur healthcare expenses cover karne mein madad karti hai.\nAuto Insurance: Car accidents, damage aur liability ke against protection deti hai.\nHome Insurance: Ghar aur belongings ko covered risks se protect karti hai.\nBusiness Insurance: Business ko covered losses aur liabilities se protect karti hai.\nTravel Insurance: Travel ke dauran covered medical emergencies aur doosre risks se protection deti hai.' },
  { type: 'heading', text: '3. Life Insurance ki 3 main types' },
  { type: 'bullets', text: 'Term Life: Specific period ke liye coverage, jaise 10, 20 ya 30 years.\nWhole Life: Permanent life coverage, usually cash value ke saath.\nUniversal Life: Permanent life coverage with a cash-value component aur policy ke mutabiq flexible options.' },
  { type: 'heading', text: 'Yaad rakho' },
  { type: 'paragraph', text: 'Insurance ka main purpose financial protection dena hai, taake unexpected situations mein financial burden kam ho sake.' },
];
const INSURANCE_PREVIOUS_ENGLISH_BLOCKS = [
  { type: 'heading', text: 'Insurance – Basic Training' },
  { type: 'heading', text: '1. What is insurance?' },
  { type: 'paragraph', text: 'Insurance is financial protection. A customer pays a premium and, subject to the policy terms, may receive a financial benefit in the event of an accident, illness, death, or other covered loss.' },
  { type: 'heading', text: '2. Main types of insurance' },
  { type: 'numbered', text: 'Life Insurance: Provides financial protection for the family in the event of the insured person’s death.\nHealth Insurance: Helps cover medical and healthcare expenses.\nAuto Insurance: Provides protection against covered car accidents, damage, and liability.\nHome Insurance: Protects a home and belongings against covered risks.\nBusiness Insurance: Protects a business against covered losses and liabilities.\nTravel Insurance: Provides protection for covered medical emergencies and other risks during travel.' },
  { type: 'heading', text: '3. Three main types of life insurance' },
  { type: 'bullets', text: 'Term Life: Coverage for a specific period, such as 10, 20, or 30 years.\nWhole Life: Permanent life coverage, usually with a cash-value component.\nUniversal Life: Permanent life coverage with a cash-value component and flexible options, subject to the policy terms.' },
  { type: 'heading', text: 'Remember' },
  { type: 'paragraph', text: 'The main purpose of insurance is to provide financial protection and help reduce the financial burden of unexpected situations.' },
];
const BUSINESS_LOANS_TRAINING_BLOCKS = [
  { type: 'heading', text: 'Business Loan – Simple Training' },
  { type: 'bullets', text: [
    'Credit Score: The client should have a credit score of at least 700.',
    'Loan Types: Personal loans and business loans are different.',
    'Our Help: We help clients with the process of getting a business loan.',
    'Existing Loan: If the client already has a loan in process, they may not qualify for another loan.',
    'Government Grant or Mortgage: If the client has a government grant or mortgage, it can affect their loan eligibility.',
    'Loan Amount: The amount depends on the client’s credit score, business, and any existing loans or grants. We cannot confirm the exact amount in advance.',
  ].join('\n') },
];
const ACCOUNTING_TRAINING_BLOCKS = [
  { type: 'heading', text: 'Accounting – Basic Training for Freshers' },
  { type: 'heading', text: 'What is Accounting?' },
  { type: 'paragraph', text: 'Accounting means keeping records of a business’s income, expenses, and financial transactions.' },
  { type: 'heading', text: 'Main Accounting Services' },
  { type: 'bullets', text: [
    'Bookkeeping: Recording daily income and expenses.',
    'Personal Tax (T1): Filing an individual’s tax return.',
    'Business Income (T2125): Reporting income and expenses for a self-employed business.',
    'Corporate Tax (T2): Filing a company’s tax return.',
    'Trust Tax (T3): Reporting income for a trust.',
    'Payroll: Managing employee salaries and deductions.',
    'GST/HST: Filing a business’s sales tax return.',
    'Tax Slips (T4, T4A, T5): Showing salary, pension, and investment income.',
  ].join('\n') },
  { type: 'heading', text: 'Easy Rule' },
  { type: 'bullets', text: [
    'Tax Return: A form used to report income and calculate taxes.',
    'Tax Slip: A document that shows income received during the year.',
  ].join('\n') },
  { type: 'paragraph', text: 'Remember: Accounting helps businesses manage their money, maintain records, and file taxes correctly.' },
];
const DIGITAL_MEDIA_TARGETING_BLOCKS = [
  { type: 'heading', text: 'Canadian Business Targeting – Agent Training Guide' },
  { type: 'heading', text: 'Our Services' },
  { type: 'numbered', text: [
    'Website and Web Application Development',
    'Search Engine Optimization (SEO)',
    'Social Media Marketing (SMM)',
    'Digital Marketing and Lead Generation',
    'Agentic AI Solutions',
    'Generative AI Solutions',
    'Customer Relationship Management (CRM)',
    'Enterprise Resource Planning (ERP)',
    'Custom Software Development and API Integrations',
  ].join('\n') },
  { type: 'heading', text: 'Business-Wise Requirements and Opportunities' },
  { type: 'numbered', text: [
    'Cleaning and Home Services — Needs: local customer acquisition, cleaning bookings, quotations, cleaner assignments, and recurring contracts. Relevant solutions: Local SEO, Google Ads, booking websites, AI receptionists, and scheduling CRM.',
    'Construction and HVAC — Needs: service inquiries, emergency calls, quotations, technician scheduling, and job tracking. Relevant solutions: Google Ads, contractor websites, AI call handling, quotation CRM, and field service management.',
    'Real Estate and Realtors — Needs: buyer/seller leads, property advertising, inquiries, viewing appointments, and client follow-ups. Relevant solutions: lead generation, property listing websites, real estate CRM, and AI follow-up automation.',
    'Trucking and Logistics — Needs: commercial shipping clients, dispatch, driver assignments, shipment tracking, and invoicing. Relevant solutions: B2B marketing, freight quote portals, dispatch software, shipment tracking, and document automation.',
    'Accounting and Bookkeeping — Needs: financial document processing, data entry, client document collection, and bookkeeping workflows. Relevant solutions: AI OCR, transaction classification, secure client portals, and QuickBooks/Xero integration.',
    'Restaurants and Cafés — Needs: local customer acquisition, online orders, reservations, menu promotions, and customer retention. Relevant solutions: Local SEO, SMM, online ordering websites, digital menus, and loyalty systems.',
    'Automotive Businesses — Needs: service appointments, vehicle records, maintenance reminders, and repair job management. Relevant solutions: Local SEO, Google Ads, booking websites, automotive CRM, and workshop management.',
    'Hotels and Motels — Needs: direct bookings, OTA synchronization, room availability, guest communication, and housekeeping. Relevant solutions: hotel booking websites, SEO, Beds24/PMS integration, and AI guest assistants.',
    'Retail and POS Businesses — Needs: online sales, inventory tracking, POS synchronization, supplier management, and customer loyalty. Relevant solutions: e-commerce websites, digital marketing, POS integration, inventory ERP, and loyalty CRM.',
    'Staffing and Recruitment — Needs: employer acquisition, job postings, candidate applications, interview scheduling, and recruitment tracking. Relevant solutions: LinkedIn lead generation, recruitment websites, ATS, recruitment CRM, and AI scheduling.',
  ].join('\n') },
  { type: 'heading', text: 'Agent Research and Calling Focus' },
  { type: 'bullets', text: [
    'Cleaning: How does the company receive and manage cleaning bookings?',
    'Construction and HVAC: How are emergency inquiries, estimates, and technicians managed?',
    'Real Estate: How are buyer/seller leads generated and followed up?',
    'Trucking and Logistics: Does the company use dispatch and shipment management software?',
    'Accounting: How much financial data entry and document processing is manual?',
    'Restaurants: Are orders received directly or mainly through third-party platforms?',
    'Automotive: How are service appointments and customer reminders managed?',
    'Hotels and Motels: Are reservations and room availability synchronized across booking platforms?',
    'Retail: Are online sales, inventory, and POS systems connected?',
    'Staffing: How are candidates, interviews, and employer clients managed?',
  ].join('\n') },
  { type: 'heading', text: 'Agent Instruction' },
  { type: 'paragraph', text: 'Identify the customer’s actual business problem first. Then introduce only the relevant service. The goal is to generate interest and book a consultation—not to explain or sell every service.' },
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
    blocks: slug === 'atm'
      ? [...ATM_COMMISSION_BLOCKS, ...ATM_RENTAL_BLOCKS, ...ATM_BUY_BLOCKS]
      : slug === 'pos' ? POS_TRAINING_BLOCKS
        : slug === 'insurance' ? INSURANCE_TRAINING_BLOCKS
          : slug === 'business-loans' ? BUSINESS_LOANS_TRAINING_BLOCKS
            : slug === 'accounting' ? ACCOUNTING_TRAINING_BLOCKS
              : slug === 'digital-media' ? DIGITAL_MEDIA_TARGETING_BLOCKS : [{ type: 'paragraph', text: summary }],
    ...(slug === 'pos' ? { posContentVersion: 1 } : {}),
    ...(slug === 'insurance' ? { insuranceContentVersion: 3 } : {}),
    ...(slug === 'business-loans' ? { businessLoansContentVersion: 1 } : {}),
    ...(slug === 'accounting' ? { accountingContentVersion: 1 } : {}),
    ...(slug === 'digital-media' ? { digitalMediaContentVersion: 1 } : {}),
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
  // Normalize legacy POS starter content once. The old read-time migration
  // appended defaults on every request, so HR-edited rates stayed above while
  // the default rate was re-added below. Preserve any custom rate, collapse
  // duplicate rate lines, then mark the category migrated so reads are stable.
  const posCategory = await TrainingCategory.findOne({ ...base, slug: 'pos' })
    .select('_id blocks revision summary posContentVersion').lean();
  if (posCategory && (posCategory.posContentVersion || 0) < 1) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (posCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === posCategory.summary)) return false;
      return true;
    });
    const defaultDebitRate = 'Debit Card: 4 cents per transaction.';
    const defaultCreditRate = 'Credit Card: 0.29% per transaction.';
    const debitCandidates = existingBlocks.flatMap(block => block.type === 'bullets'
      ? block.text.split(/\r?\n/).map(line => line.trim()).filter(line => /^Debit Card:/i.test(line))
      : []);
    const creditCandidates = existingBlocks.flatMap(block => block.type === 'bullets'
      ? block.text.split(/\r?\n/).map(line => line.trim()).filter(line => /^Credit Card:/i.test(line))
      : []);
    const debitRate = [...debitCandidates].reverse().find(line => line.toLowerCase() !== defaultDebitRate.toLowerCase())
      || debitCandidates[0] || defaultDebitRate;
    const creditRate = [...creditCandidates].reverse().find(line => line.toLowerCase() !== defaultCreditRate.toLowerCase())
      || creditCandidates[0] || defaultCreditRate;
    const rateHeading = '4. Interchange Rate';
    const managedPosBlocks = [...POS_PREVIOUS_BLOCKS, ...POS_TRAINING_BLOCKS];
    const authoredBlocks = existingBlocks.filter(block => {
      if (block.type === 'heading' && (block.text === rateHeading || managedPosBlocks.some(item => item.type === 'heading' && item.text === block.text))) return false;
      if (block.type === 'bullets' && /(?:^|\n)\s*(?:Debit|Credit) Card:/i.test(block.text)) return false;
      return !managedPosBlocks.some(item => item.type === block.type && item.text === block.text);
    });
    const canonicalPosBlocks = POS_TRAINING_BLOCKS.map(block => block.type === 'bullets'
      && block.text.includes(defaultDebitRate) && block.text.includes(defaultCreditRate)
      ? { ...block, text: `${debitRate}\n${creditRate}` }
      : block);
    const nextBlocks = [...authoredBlocks, ...canonicalPosBlocks];
    const changed = nextBlocks.length !== (posCategory.blocks || []).length
      || nextBlocks.some((block, index) => block.type !== posCategory.blocks[index]?.type || block.text !== posCategory.blocks[index]?.text);
    if (changed || (posCategory.posContentVersion || 0) < 1) {
      await TrainingCategory.findOneAndUpdate({
        _id: posCategory._id,
        companyId: actor.companyId,
        deletedAt: null,
        revision: posCategory.revision,
      }, {
        $set: { blocks: nextBlocks, posContentVersion: 1 },
        $inc: { revision: 1 },
      }, { new: true, runValidators: true });
    }
  }
  // Replace the previous insurance primer with the latest HR-approved seven
  // types, retaining unrelated authored material and avoiding read-time repeats.
  const insuranceCategory = await TrainingCategory.findOne({ ...base, slug: 'insurance' })
    .select('_id blocks revision summary insuranceContentVersion').lean();
  if (insuranceCategory && (insuranceCategory.insuranceContentVersion || 0) < 3) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (insuranceCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === insuranceCategory.summary)) return false;
      return true;
    });
    const previousAndCurrentContent = [...INSURANCE_PREVIOUS_BLOCKS, ...INSURANCE_PREVIOUS_ENGLISH_BLOCKS, ...INSURANCE_TRAINING_BLOCKS];
    const authoredBlocks = existingBlocks.filter(block => !previousAndCurrentContent.some(item => item.type === block.type && item.text === block.text));
    const nextBlocks = [...authoredBlocks, ...INSURANCE_TRAINING_BLOCKS];
    await TrainingCategory.findOneAndUpdate({
      _id: insuranceCategory._id,
      companyId: actor.companyId,
      deletedAt: null,
      revision: insuranceCategory.revision,
    }, {
      $set: { blocks: nextBlocks, insuranceContentVersion: 3 },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true });
  }
  // Add the HR-provided business-loan guide once, keeping unrelated content.
  const businessLoansCategory = await TrainingCategory.findOne({ ...base, slug: 'business-loans' })
    .select('_id blocks revision summary businessLoansContentVersion').lean();
  if (businessLoansCategory && (businessLoansCategory.businessLoansContentVersion || 0) < 1) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (businessLoansCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === businessLoansCategory.summary)) return false;
      return true;
    });
    const authoredBlocks = existingBlocks.filter(block => !BUSINESS_LOANS_TRAINING_BLOCKS.some(item => item.type === block.type && item.text === block.text));
    await TrainingCategory.findOneAndUpdate({
      _id: businessLoansCategory._id,
      companyId: actor.companyId,
      deletedAt: null,
      revision: businessLoansCategory.revision,
    }, {
      $set: { blocks: [...authoredBlocks, ...BUSINESS_LOANS_TRAINING_BLOCKS], businessLoansContentVersion: 1 },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true });
  }
  // Add the fresher accounting guide once while retaining other HR content.
  const accountingCategory = await TrainingCategory.findOne({ ...base, slug: 'accounting' })
    .select('_id blocks revision summary accountingContentVersion').lean();
  if (accountingCategory && (accountingCategory.accountingContentVersion || 0) < 1) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (accountingCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === accountingCategory.summary)) return false;
      return true;
    });
    const authoredBlocks = existingBlocks.filter(block => !ACCOUNTING_TRAINING_BLOCKS.some(item => item.type === block.type && item.text === block.text));
    await TrainingCategory.findOneAndUpdate({
      _id: accountingCategory._id,
      companyId: actor.companyId,
      deletedAt: null,
      revision: accountingCategory.revision,
    }, {
      $set: { blocks: [...authoredBlocks, ...ACCOUNTING_TRAINING_BLOCKS], accountingContentVersion: 1 },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true });
  }
  // Add the Canadian business-targeting guide to existing Digital Media tabs
  // once, retaining any unrelated content authored by HR.
  const digitalMediaCategory = await TrainingCategory.findOne({ ...base, slug: 'digital-media' })
    .select('_id blocks revision summary digitalMediaContentVersion').lean();
  if (digitalMediaCategory && (digitalMediaCategory.digitalMediaContentVersion || 0) < 1) {
    const placeholder = 'HR can edit this page to add the training material, process steps, and learning resources.';
    const existingBlocks = (digitalMediaCategory.blocks || []).filter(block => {
      if (block.type === 'heading' && block.text === 'Training details') return false;
      if (block.type === 'paragraph' && (block.text === placeholder || block.text === digitalMediaCategory.summary)) return false;
      return true;
    });
    const authoredBlocks = existingBlocks.filter(block => !DIGITAL_MEDIA_TARGETING_BLOCKS.some(item => item.type === block.type && item.text === block.text));
    await TrainingCategory.findOneAndUpdate({
      _id: digitalMediaCategory._id,
      companyId: actor.companyId,
      deletedAt: null,
      revision: digitalMediaCategory.revision,
    }, {
      $set: { blocks: [...authoredBlocks, ...DIGITAL_MEDIA_TARGETING_BLOCKS], digitalMediaContentVersion: 1 },
      $inc: { revision: 1 },
    }, { new: true, runValidators: true });
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
