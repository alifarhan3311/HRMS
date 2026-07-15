/**
 * modules/attendance/attendance.routes.js
 */
const express = require('express');
const controller = require('./attendance.controller');
const repository = require('./attendance.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALL = ['super_admin', 'admin', 'hr', 'finance', 'manager', 'team_lead', 'employee'];
const ADMIN_HR = ['super_admin', 'admin', 'hr'];
const MANAGERS_UP = ['super_admin', 'admin', 'hr', 'manager', 'team_lead'];

router.use(authenticate);

// Employee self-service
router.post('/sign-in', authorize(...ALL), controller.signIn);
router.post('/sign-out', authorize(...ALL), controller.signOut);
router.get('/today', authorize(...ALL), controller.today);
router.get('/monthly-summary', authorize(...ALL), controller.monthlySummary);

// Admin/HR views
router.get('/', authorize(...ALL), controller.list);
router.get('/pending-regularizations', authorize(...ADMIN_HR, ...MANAGERS_UP), controller.pendingRegularizations);

// Per-record operations
router.get(
  '/:id',
  authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);

// Manual correction (HR/Admin only)
router.put(
  '/:id/correct',
  authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.manualCorrection
);

// Regularization request (employee)
router.post(
  '/:id/regularize',
  authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.requestRegularization
);

// Regularization review (HR/Manager)
router.patch(
  '/:id/regularize/review',
  authorize(...ADMIN_HR, 'manager'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.reviewRegularization
);

module.exports = router;
