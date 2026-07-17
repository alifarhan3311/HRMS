const service = require('./expenseCategories.service');

const fn = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const list = fn(async (req, res) => {
  res.json({ success: true, data: await service.listCategories(req.user) });
});
const create = fn(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createCategory(req.body, req.user) });
});
const update = fn(async (req, res) => {
  res.json({ success: true, data: await service.updateCategory(req.params.categoryId, req.body, req.user) });
});
const remove = fn(async (req, res) => {
  res.json({ success: true, ...(await service.deleteCategory(req.params.categoryId, req.user)) });
});

module.exports = { list, create, update, remove };
