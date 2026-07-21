/**
 * modules/expenses/expenses.controller.js
 */
const service = require('./expenses.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const submit   = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await service.submitExpense(req.body, req.user) }); });
const list     = asyncHandler(async (req, res) => { const r = await service.listExpenses(req.query, req.user); res.json({ success: true, ...r }); });
const getById  = asyncHandler(async (req, res) => { res.json({ success: true, data: await service.getExpenseById(req.params.id, req.user) }); });

module.exports = { submit, list, getById };
