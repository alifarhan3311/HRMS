/**
 * modules/expenses/expenses.repository.js
 */
const Expense = require('./expenses.model');

async function create(data) { return Expense.create(data); }
async function createMany(data) { return Expense.insertMany(data, { ordered: true }); }

async function findById(id) {
  return Expense.findById(id)
    .populate('submittedBy', 'fullName employeeCode department designation profilePicture');
}

async function findImageById(id) {
  return Expense.findById(id).select('+expenseSheetImage expenseSheetMimeType expenseSheetFileName companyId');
}
async function deleteById(id) { return Expense.findByIdAndDelete(id); }

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .populate('submittedBy', 'fullName employeeCode department profilePicture')
      .sort(sort).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { create, createMany, findById, findImageById, findAll, deleteById };
