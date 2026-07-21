const createHttpError = require('http-errors');
const ExpenseCategory = require('./expenseCategories.model');
const Expense = require('./expenses.model');

const DEFAULT_CATEGORIES = [
  'Office Expenses',
  'Utility Bills',
  'Internet Bills',
  'Fuel Expenses',
  'Travel Expenses',
  'Maintenance Expenses',
  'Miscellaneous Expenses',
];

async function ensureDefaults(companyId) {
  await ExpenseCategory.bulkWrite(DEFAULT_CATEGORIES.map(name => ({
    updateOne: {
      filter: { companyId, name },
      update: { $setOnInsert: { companyId, name, active: true } },
      upsert: true,
    },
  })), { ordered: false });
}

async function listCategories(actor) {
  await ensureDefaults(actor.companyId);
  const filter = { companyId: actor.companyId };
  if (!['hr', 'super_admin'].includes(actor.role)) filter.active = true;
  return ExpenseCategory.find(filter).sort({ active: -1, name: 1 });
}

async function createCategory(payload, actor) {
  try {
    return await ExpenseCategory.create({
      ...payload,
      companyId: actor.companyId,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  } catch (error) {
    if (error.code === 11000) throw createHttpError(409, 'An expense category with this name already exists.');
    throw error;
  }
}

async function updateCategory(id, payload, actor) {
  try {
    const category = await ExpenseCategory.findOneAndUpdate(
      { _id: id, companyId: actor.companyId },
      { $set: { ...payload, updatedBy: actor.id } },
      { new: true, runValidators: true },
    );
    if (!category) throw createHttpError(404, 'Expense category not found.');
    return category;
  } catch (error) {
    if (error.code === 11000) throw createHttpError(409, 'An expense category with this name already exists.');
    throw error;
  }
}

async function deleteCategory(id, actor) {
  const category = await ExpenseCategory.findOne({ _id: id, companyId: actor.companyId });
  if (!category) throw createHttpError(404, 'Expense category not found.');
  const inUse = await Expense.exists({ companyId: actor.companyId, category: category.name });
  if (inUse) throw createHttpError(409, 'This category is used by existing expenses. Deactivate it instead.');
  await category.deleteOne();
  return { message: 'Expense category deleted.' };
}

async function assertActiveCategory(name, companyId) {
  await ensureDefaults(companyId);
  const category = await ExpenseCategory.exists({ companyId, name, active: true });
  if (!category) throw createHttpError(422, 'Select an active expense category.');
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assertActiveCategory,
};
