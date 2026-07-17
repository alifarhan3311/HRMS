/**
 * modules/employees/employees.routes.js
 * Route wiring: auth → RBAC → tenant-scope → controller.
 */
const express = require('express');
const controller = require('./employees.controller');
const repository = require('./employees.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const HR_MANAGEMENT = ['hr', 'super_admin'];
const MANAGER_UP = ['manager', 'hr', 'super_admin'];

router.use(authenticate);

// List & stats
router.get('/', authorize(...HR_MANAGEMENT), controller.list);
router.get('/departments', authorize(...HR_MANAGEMENT), controller.departments);
router.get('/stats', authorize(...HR_MANAGEMENT), controller.stats);

// Create
router.post('/', authorize(...HR_MANAGEMENT), controller.create);

// Single employee operations
router.get(
  '/:id',
  authorize(...MANAGER_UP),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);

router.put(
  '/:id',
  authorize(...HR_MANAGEMENT),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.update
);

router.delete(
  '/:id',
  authorize(...HR_MANAGEMENT),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.remove
);

// Status change (active/inactive/resigned)
router.patch(
  '/:id/status',
  authorize(...HR_MANAGEMENT),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.changeStatus
);

// Promotion / designation change
router.post(
  '/:id/promote',
  authorize(...HR_MANAGEMENT),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.promote
);

module.exports = router;
