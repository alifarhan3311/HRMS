/**
 * Simple company expense ledger.
 * HR records entries; Super Admin has read-only company-wide visibility.
 */
const createHttpError = require('http-errors');
const repository = require('./expenses.repository');
const categoryService = require('./expenseCategories.service');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');
const mongoose = require('mongoose');

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

function assertExpenseViewer(actor) {
  if (!['hr', 'super_admin'].includes(actor.role)) {
    throw createHttpError(403, 'Only HR and Super Admin can view recorded expenses.');
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

async function submitBulkExpenses(rows, actor) {
  await categoryService.assertActiveCategory('Miscellaneous Expenses', actor.companyId);
  const batchId = new mongoose.Types.ObjectId();
  const documents = rows.map((row) => {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    return {
      category: 'Miscellaneous Expenses',
      vendorName: row.productName,
      productName: row.productName,
      quantity,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
      expenseDate: new Date(row.expenseDate),
      paymentMethod: 'Cash',
      remarks: `Bulk expense entry: ${row.productName}`,
      submittedBy: actor.id,
      status: 'recorded',
      approvalChain: [],
      companyId: actor.companyId,
      branchId: actor.branchId,
      batchId,
    };
  });
  const expenses = await repository.createMany(documents);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const submitter = await Employee.findById(actor.id).select('fullName');
  await notifySuperAdmins(actor.companyId, {
    companyId: actor.companyId,
    type: 'expense_recorded',
    title: 'Bulk expenses recorded',
    message: `${submitter?.fullName || 'HR'} recorded ${expenses.length} expense items totalling PKR ${total.toLocaleString()}.`,
    link: '/expenses',
    metadata: { batchId, count: expenses.length, total },
    dedupeKey: `expense-batch-recorded:${batchId}`,
  });
  return { batchId, count: expenses.length, total, items: expenses };
}

async function listExpenses(query, actor) {
  assertExpenseViewer(actor);
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
  assertExpenseViewer(actor);
  const expense = await repository.findById(id);
  if (!expense || String(expense.companyId) !== String(actor.companyId)) {
    throw createHttpError(404, 'Expense not found.');
  }
  return expense;
}

module.exports = { submitExpense, submitBulkExpenses, listExpenses, getExpenseById };
