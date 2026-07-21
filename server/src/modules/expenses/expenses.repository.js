/**
 * modules/expenses/expenses.repository.js
 */
const Expense = require('./expenses.model');

async function create(data) { return Expense.create(data); }

async function findById(id) {
  return Expense.findById(id)
    .populate('submittedBy', 'fullName employeeCode department designation profilePicture');
}

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

module.exports = { create, findById, findAll };
