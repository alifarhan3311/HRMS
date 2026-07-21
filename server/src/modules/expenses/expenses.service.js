/**
 * modules/expenses/expenses.service.js
 * Expense management with multi-stage approval workflow:
 * HR verification -> Super Admin approval -> Payment
 */
const createHttpError = require('http-errors');
const repository = require('./expenses.repository');
const categoryService = require('./expenseCategories.service');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');

async function notifyMany(recipientIds, notification) {
  const uniqueIds = [...new Set(recipientIds.filter(Boolean).map(String))];
  await Promise.allSettled(uniqueIds.map(recipientId => notificationService.createNotification({
    ...notification,
    recipientId,
    dedupeKey: `${notification.dedupeKey}:${recipientId}`,
  })));
}

async function activeRoleIds(companyId, roles) {
  const employees = await Employee.find({ companyId, role: { $in: roles }, status: 'active' }).select('_id');
  return employees.map(employee => employee._id);
}

async function assertExpenseVisible(expense, actor) {
  const submitterId = expense.submittedBy?._id || expense.submittedBy;
  if (actor.role === 'super_admin') return;
  const submitter = await Employee.findById(submitterId).select('companyId role managerId');
  if (!submitter || String(submitter.companyId) !== String(actor.companyId)) {
    throw createHttpError(404, 'Expense not found.');
  }
  if (submitter.role === 'super_admin') throw createHttpError(403, 'Super Admin expenses are protected.');
  if (actor.role !== 'hr') {
    throw createHttpError(403, 'Only HR and Super Admin can access company expenses.');
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitExpense(payload, actor) {
  const { category, vendorName, amount, expenseDate, paymentMethod, remarks, invoiceUrl } = payload;
  await categoryService.assertActiveCategory(category, actor.companyId);
  if (!amount || amount <= 0) throw createHttpError(400, 'Amount must be positive.');

  const expense = await repository.create({
    category, vendorName, amount: Number(amount),
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    paymentMethod, remarks, invoiceUrl: invoiceUrl || '',
    submittedBy: actor.id,
    status: 'pending',
    approvalChain: [
      { stage: 1, role: 'hr', status: 'pending' },
      { stage: 2, role: 'super_admin', status: 'pending' },
    ],
    currentStage: 1,
    companyId: actor.companyId,
    branchId: actor.branchId,
  });

  const submitter = await Employee.findById(actor.id).select('fullName');
  const hrIds = await activeRoleIds(actor.companyId, ['hr']);
  await notifyMany(hrIds, {
    companyId: actor.companyId,
    type: 'expense_approval_required',
    title: 'Expense approval required',
    message: `${submitter?.fullName || 'An employee'} submitted ${category} for PKR ${Number(amount).toLocaleString()}.`,
    link: '/expenses',
    metadata: { expenseId: expense._id, stage: 1 },
    dedupeKey: `expense-submitted:${expense._id}`,
  });
  return expense;
}

// ─── Approve ─────────────────────────────────────────────────────────────────
async function approveExpense(id, { remarks }, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  await assertExpenseVisible(expense, actor);
  if (!['pending','processing'].includes(expense.status)) {
    throw createHttpError(400, 'This expense cannot be approved.');
  }

  const ROLE_STAGE = { hr: 1, super_admin: 2 };
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

  const isLast = actorStage === 2;
  const updated = await repository.updateById(id, {
    approvalChain: chain,
    currentStage: isLast ? actorStage : actorStage + 1,
    status: isLast ? 'approved' : 'processing',
  });
  if (isLast) {
    await notifyMany([expense.submittedBy?._id || expense.submittedBy], {
      companyId: expense.companyId,
      type: 'expense_approved',
      title: 'Expense approved',
      message: `Your ${expense.category} expense for PKR ${Number(expense.amount).toLocaleString()} was approved.`,
      link: '/expenses',
      metadata: { expenseId: expense._id },
      dedupeKey: `expense-approved:${expense._id}`,
    });
  } else {
    const superAdminIds = await activeRoleIds(expense.companyId, ['super_admin']);
    await notifyMany(superAdminIds, {
      companyId: expense.companyId,
      type: 'expense_admin_verification_required',
      title: 'Expense approval required',
      message: `${expense.submittedBy?.fullName || 'An employee'}'s expense was verified by HR and needs Super Admin approval.`,
      link: '/expenses',
      metadata: { expenseId: expense._id, stage: 2 },
      dedupeKey: `expense-hr-verified:${expense._id}`,
    });
  }
  return updated;
}

// ─── Reject ──────────────────────────────────────────────────────────────────
async function rejectExpense(id, { remarks }, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  await assertExpenseVisible(expense, actor);
  if (!['pending','processing'].includes(expense.status)) {
    throw createHttpError(400, 'This expense cannot be rejected.');
  }

  const ROLE_STAGE = { hr: 1, super_admin: 2 };
  const actorStage = ROLE_STAGE[actor.role];
  if (!actorStage) throw createHttpError(403, 'Your role cannot reject expenses.');
  if (actorStage !== expense.currentStage) {
    throw createHttpError(403, `This expense is at stage ${expense.currentStage}.`);
  }
  const chain = (expense.approvalChain || []).map(step =>
    step.stage === actorStage
      ? { ...step, status: 'rejected', approvedBy: actor.id, actionAt: new Date(), remarks: remarks||'' }
      : step
  );
  const updated = await repository.updateById(id, { approvalChain: chain, status: 'rejected' });
  await notifyMany([expense.submittedBy?._id || expense.submittedBy], {
    companyId: expense.companyId,
    type: 'expense_rejected',
    title: 'Expense rejected',
    message: `Your ${expense.category} expense was rejected${remarks ? `: ${remarks}` : '.'}`,
    link: '/expenses',
    metadata: { expenseId: expense._id },
    dedupeKey: `expense-rejected:${expense._id}`,
  });
  return updated;
}

// ─── Mark Paid ────────────────────────────────────────────────────────────────
async function markPaid(id, actor) {
  const expense = await repository.findById(id);
  if (!expense) throw createHttpError(404, 'Expense not found.');
  await assertExpenseVisible(expense, actor);
  if (expense.status !== 'approved') throw createHttpError(400, 'Only approved expenses can be marked paid.');
  const updated = await repository.updateById(id, { status: 'paid', paidAt: new Date(), paidBy: actor.id });
  await notifyMany([expense.submittedBy?._id || expense.submittedBy], {
    companyId: expense.companyId,
    type: 'expense_paid',
    title: 'Expense payment completed',
    message: `Your ${expense.category} expense payment of PKR ${Number(expense.amount).toLocaleString()} is marked paid.`,
    link: '/expenses',
    metadata: { expenseId: expense._id },
    dedupeKey: `expense-paid:${expense._id}`,
  });
  return updated;
}

// ─── List ────────────────────────────────────────────────────────────────────
async function listExpenses(query, actor) {
  const { page=1, limit=20, status, category, dateFrom, dateTo, sort='-createdAt' } = query;
  const filter = { companyId: actor.companyId };

  if (actor.role === 'hr') {
    filter.submittedBy = { $in: await Employee.find({ companyId: actor.companyId, role: { $ne: 'super_admin' } }).distinct('_id') };
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

async function getExpenseById(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Expense not found.');
  await assertExpenseVisible(record, actor);
  return record;
}

module.exports = { submitExpense, approveExpense, rejectExpense, markPaid, listExpenses, getExpenseById };
