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
const ALL       = ['super_admin','admin','hr','manager','team_lead','employee'];
const APPROVERS = ['super_admin','admin','manager'];

router.use(authenticate);

router.get('/categories', authorize(...ALL), categoryController.list);
router.post('/categories', authorize('super_admin', 'admin'), validate(createCategorySchema), categoryController.create);
router.put('/categories/:categoryId', authorize('super_admin', 'admin'),
  validate(categoryIdSchema, 'params'), validate(updateCategorySchema), categoryController.update);
router.delete('/categories/:categoryId', authorize('super_admin', 'admin'),
  validate(categoryIdSchema, 'params'), categoryController.remove);

router.post('/', authorize(...ALL), validate(createSchema), controller.submit);
router.get('/',  authorize(...ALL),    controller.list);

router.get('/:id', authorize(...ALL),
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

router.patch('/:id/paid', authorize('super_admin','admin'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.markPaid);

module.exports = router;
