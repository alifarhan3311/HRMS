/**
 * Simple company expense ledger.
 * HR records entries; Super Admin has read-only company-wide visibility.
 */
const createHttpError = require('http-errors');
const repository = require('./expenses.repository');
const categoryService = require('./expenseCategories.service');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');

async function notifySuperAdmins(companyId, notification) {
  const recipients = await Employee.find({
    companyId,
    role: 'super_admin',
    status: 'active',
  }).select('_id');

  await Promise.allSettled(recipients.map(({ _id }) => notificationService.createNotification({
    ...notification,
    recipientId: _id,
    dedupeKey: `${notification.dedupeKey}:${_id}`,
  })));
}

function assertSuperAdmin(actor) {
  if (actor.role !== 'super_admin') {
    throw createHttpError(403, 'Only Super Admin can view recorded expenses.');
  }
}

async function submitExpense(payload, actor) {
  const { category, vendorName, amount, expenseDate, paymentMethod, remarks, invoiceUrl } = payload;
  await categoryService.assertActiveCategory(category, actor.companyId);

  const expense = await repository.create({
    category,
    vendorName,
    amount: Number(amount),
    expenseDate: new Date(expenseDate),
    paymentMethod,
    remarks,
    invoiceUrl: invoiceUrl || '',
    submittedBy: actor.id,
    status: 'recorded',
    approvalChain: [],
    companyId: actor.companyId,
    branchId: actor.branchId,
  });

  const submitter = await Employee.findById(actor.id).select('fullName');
  await notifySuperAdmins(actor.companyId, {
    companyId: actor.companyId,
    type: 'expense_recorded',
    title: 'New expense recorded',
    message: `${submitter?.fullName || 'HR'} recorded ${category} for PKR ${Number(amount).toLocaleString()}.`,
    link: '/expenses',
    metadata: { expenseId: expense._id },
    dedupeKey: `expense-recorded:${expense._id}`,
  });

  return expense;
}

async function listExpenses(query, actor) {
  assertSuperAdmin(actor);
  const { page = 1, limit = 20, status, category, dateFrom, dateTo, sort = '-createdAt' } = query;
  const filter = { companyId: actor.companyId };

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (dateFrom || dateTo) {
    filter.expenseDate = {};
    if (dateFrom) filter.expenseDate.$gte = new Date(dateFrom);
    if (dateTo) filter.expenseDate.$lte = new Date(dateTo);
  }

  return repository.findAll({
    filter,
    page: Number(page),
    limit: Math.min(Number(limit), 100),
    sort,
  });
}

async function getExpenseById(id, actor) {
  assertSuperAdmin(actor);
  const expense = await repository.findById(id);
  if (!expense || String(expense.companyId) !== String(actor.companyId)) {
    throw createHttpError(404, 'Expense not found.');
  }
  return expense;
}

module.exports = { submitExpense, listExpenses, getExpenseById };
