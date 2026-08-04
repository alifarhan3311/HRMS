/**
 * modules/expenses/expenses.routes.js
 */
const express = require('express');
const multer = require('multer');
const controller = require('./expenses.controller');
const repository = require('./expenses.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const categoryController = require('./expenseCategories.controller');
const { createSchema, bulkCreateSchema, imageCreateSchema } = require('./expenses.validation');
const {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./expenseCategories.validation');

const router = express.Router();
const EXPENSE_ROLES = ['super_admin', 'hr'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

router.use(authenticate);

router.get('/categories', authorize(...EXPENSE_ROLES), categoryController.list);
router.post('/categories', authorize('hr'), validate(createCategorySchema), categoryController.create);
router.put('/categories/:categoryId', authorize('hr'),
  validate(categoryIdSchema, 'params'), validate(updateCategorySchema), categoryController.update);
router.delete('/categories/:categoryId', authorize('hr'),
  validate(categoryIdSchema, 'params'), categoryController.remove);

router.post('/', authorize('hr'), validate(createSchema), controller.submit);
router.post('/bulk', authorize('hr'), validate(bulkCreateSchema), controller.submitBulk);
router.post('/sheet', authorize('hr'), upload.single('image'), validate(imageCreateSchema), controller.submitSheet);
router.get('/', authorize(...EXPENSE_ROLES), controller.list);

router.get('/:id/image', authorize(...EXPENSE_ROLES), controller.getImage);
router.delete('/:id', authorize('hr'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)), controller.remove);

router.get('/:id', authorize(...EXPENSE_ROLES),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

module.exports = router;
