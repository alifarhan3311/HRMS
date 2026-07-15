/**
 * modules/employees/employees.routes.js
 * Route wiring: auth → RBAC → tenant-scope → controller.
 */
const express = require('express');
const controller = require('./employees.controller');
const repository = require('./employees.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ADMIN_HR = ['admin', 'hr', 'super_admin'];
const MANAGER_UP = ['manager', 'admin', 'hr', 'super_admin'];

router.use(authenticate);

// List & stats
router.get('/', authorize(...ADMIN_HR), controller.list);
router.get('/departments', authorize(...ADMIN_HR), controller.departments);
router.get('/stats', authorize(...ADMIN_HR), controller.stats);

// Create
router.post('/', authorize(...ADMIN_HR), controller.create);

// Single employee operations
router.get(
  '/:id',
  authorize(...MANAGER_UP),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);

router.put(
  '/:id',
  authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.update
);

router.delete(
  '/:id',
  authorize('admin', 'super_admin'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.remove
);

// Status change (active/inactive/resigned)
router.patch(
  '/:id/status',
  authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.changeStatus
);

// Promotion / designation change
router.post(
  '/:id/promote',
  authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.promote
);

module.exports = router;
