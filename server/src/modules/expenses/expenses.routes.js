/**
 * modules/expenses/expenses.routes.js
 */
const express = require('express');
const controller = require('./expenses.controller');
const repository = require('./expenses.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const categoryController = require('./expenseCategories.controller');
const { createSchema } = require('./expenses.validation');
const {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./expenseCategories.validation');

const router = express.Router();
const EXPENSE_ROLES = ['super_admin', 'hr'];

router.use(authenticate);

router.get('/categories', authorize(...EXPENSE_ROLES), categoryController.list);
router.post('/categories', authorize('hr'), validate(createCategorySchema), categoryController.create);
router.put('/categories/:categoryId', authorize('hr'),
  validate(categoryIdSchema, 'params'), validate(updateCategorySchema), categoryController.update);
router.delete('/categories/:categoryId', authorize('hr'),
  validate(categoryIdSchema, 'params'), categoryController.remove);

router.post('/', authorize('hr'), validate(createSchema), controller.submit);
router.get('/', authorize('super_admin'), controller.list);

router.get('/:id', authorize('super_admin'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

module.exports = router;
