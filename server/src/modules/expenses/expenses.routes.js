/**
 * modules/expenses/expenses.routes.js
 */
const express = require('express');
const controller = require('./expenses.controller');
const repository = require('./expenses.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const categoryController = require('./expenseCategories.controller');
const { createSchema, reviewSchema } = require('./expenses.validation');
const {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./expenseCategories.validation');

const router = express.Router();
const EXPENSE_ROLES = ['super_admin', 'hr'];
const APPROVERS = ['super_admin', 'hr'];

router.use(authenticate);

router.get('/categories', authorize(...EXPENSE_ROLES), categoryController.list);
router.post('/categories', authorize(...EXPENSE_ROLES), validate(createCategorySchema), categoryController.create);
router.put('/categories/:categoryId', authorize(...EXPENSE_ROLES),
  validate(categoryIdSchema, 'params'), validate(updateCategorySchema), categoryController.update);
router.delete('/categories/:categoryId', authorize(...EXPENSE_ROLES),
  validate(categoryIdSchema, 'params'), categoryController.remove);

router.post('/', authorize(...EXPENSE_ROLES), validate(createSchema), controller.submit);
router.get('/', authorize(...EXPENSE_ROLES), controller.list);

router.get('/:id', authorize(...EXPENSE_ROLES),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

router.patch('/:id/approve', authorize(...APPROVERS),
  validate(reviewSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.approve);

router.patch('/:id/reject', authorize(...APPROVERS),
  validate(reviewSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.reject);

router.patch('/:id/paid', authorize('super_admin'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.markPaid);

module.exports = router;
