/**
 * modules/expenses/expenses.service.js
 * Expense management with multi-stage approval workflow:
 * Employee/Dept → Manager → Finance Verification → Admin → Payment
 */
const createHttpError = require('http-errors');
const repository = require('./expenses.repository');

const CATEGORIES = [
  'Office Expenses','Utility Bills','Internet Bills','Fuel Expenses',
  'Travel Expenses','Maintenance Expenses','Miscellaneous',
];

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitExpense(payload, actor) {
  const { category, vendorName, amount, expenseDate, paymentMethod, remarks, invoiceUrl } = payload;
  if (!CATEGORIES.includes(category) && !category) {
    throw createHttpError(400, 'Invalid expense category.');
  }
  if (!amount || amount <= 0) throw createHttpError(400, 'Amount must be positive.');

  const expense = await repository.create({
    category, vendorName, amount: Number(amount),
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    paymentMethod, remarks, invoiceUrl: invoiceUrl || '',
    submittedBy: actor.id,
    status: 'pending',
    approvalChain: [
      { stage: 1, role: 'manager',  status: 'pending' },
      { stage: 2, role: 'finance',  status: 'pending' },
      { stage: 3, role: 'admin',    status: 'pending' },
    ],
    currentStage: 1,
    companyId: actor.companyId,
    branchId: actor.branchId,
  });
  return expense;
}

// ─── Approve ─────────────────────────────────────────────────────────────────
async function approveExpense(id, { remarks }, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  if (!['pending','processing'].includes(expense.status)) {
    throw createHttpError(400, 'This expense cannot be approved.');
  }

  const ROLE_STAGE = { manager: 1, finance: 2, admin: 3, super_admin: 3, hr: 2 };
  const actorStage = ROLE_STAGE[actor.role];
  if (!actorStage) throw createHttpError(403, 'Your role cannot approve expenses.');
  if (actorStage !== expense.currentStage) {
    throw createHttpError(403, `This expense is at stage ${expense.currentStage}.`);
  }

  const chain = (expense.approvalChain || []).map(step =>
    step.stage === actorStage
      ? { ...step, status: 'approved', approvedBy: actor.id, actionAt: new Date(), remarks: remarks||'' }
      : step
  );

  const isLast = actorStage === 3;
  const updated = await repository.updateById(id, {
    approvalChain: chain,
    currentStage: isLast ? actorStage : actorStage + 1,
    status: isLast ? 'approved' : 'processing',
  });
  return updated;
}

// ─── Reject ──────────────────────────────────────────────────────────────────
async function rejectExpense(id, { remarks }, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  if (!['pending','processing'].includes(expense.status)) {
    throw createHttpError(400, 'This expense cannot be rejected.');
  }

  const ROLE_STAGE = { manager: 1, finance: 2, admin: 3, super_admin: 3, hr: 2 };
  const actorStage = ROLE_STAGE[actor.role];
  const chain = (expense.approvalChain || []).map(step =>
    step.stage === actorStage
      ? { ...step, status: 'rejected', approvedBy: actor.id, actionAt: new Date(), remarks: remarks||'' }
      : step
  );
  const updated = await repository.updateById(id, { approvalChain: chain, status: 'rejected' });
  return updated;
}

// ─── Mark Paid ────────────────────────────────────────────────────────────────
async function markPaid(id, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  if (expense.status !== 'approved') throw createHttpError(400, 'Only approved expenses can be marked paid.');
  return repository.updateById(id, { status: 'paid', paidAt: new Date(), paidBy: actor.id });
}

// ─── List ────────────────────────────────────────────────────────────────────
async function listExpenses(query, actor) {
  const { page=1, limit=20, status, category, dateFrom, dateTo, sort='-createdAt' } = query;
  const filter = { companyId: actor.companyId };

  if (!['admin','hr','finance','super_admin','manager'].includes(actor.role)) {
    filter.submittedBy = actor.id;
  }
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (dateFrom || dateTo) {
    filter.expenseDate = {};
    if (dateFrom) filter.expenseDate.$gte = new Date(dateFrom);
    if (dateTo)   filter.expenseDate.$lte = new Date(dateTo);
  }

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit),100), sort });
}

async function getExpenseById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Expense not found.');
  return record;
}

module.exports = { submitExpense, approveExpense, rejectExpense, markPaid, listExpenses, getExpenseById };
