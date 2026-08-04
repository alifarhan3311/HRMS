/**
 * modules/expenses/expenses.controller.js
 */
const service = require('./expenses.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const submit   = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.submitExpense(req.body, req.user) }); });
const submitBulk = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.submitBulkExpenses(req.body.rows, req.user) }); });
const submitSheet = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.submitExpenseSheet(req.body, req.file, req.user) }); });
const getImage = asyncHandler(async (req, res) => {
  const expense = await service.getExpenseImage(req.params.id, req.user);
  res.set('Content-Type', expense.expenseSheetMimeType);
  res.set('Content-Disposition', `inline; filename="${String(expense.expenseSheetFileName || 'expense-sheet').replace(/["\r\n]/g, '')}"`);
  res.set('Cache-Control', 'private, max-age=300');
  res.send(expense.expenseSheetImage);
});
const list     = asyncHandler(async (req, res) => { const r = await service.listExpenses(req.query, req.user); res.json({ success: true, ...r }); });
const getById  = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.getExpenseById(req.params.id, req.user) }); });
const remove = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.deleteExpense(req.params.id, req.user) }); });

module.exports = { submit, submitBulk, submitSheet, list, getById, getImage, remove };
