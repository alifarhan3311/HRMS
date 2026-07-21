/**
 * modules/attendance/attendance.routes.js
 */
const express = require('express');
const controller = require('./attendance.controller');
const repository = require('./attendance.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  idParamsSchema,
  signInSchema,
  signOutSchema,
  monthlySummaryQuerySchema,
  rangeSummaryQuerySchema,
  listQuerySchema,
  manualCorrectionSchema,
  regularizationRequestSchema,
  regularizationReviewSchema,
} = require('./attendance.validation');

const router = express.Router();
const ALL = ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'employee'];
const HR_MANAGEMENT = ['super_admin', 'hr'];
const MANAGERS_UP = ['super_admin', 'hr', 'manager', 'team_lead'];

router.use(authenticate);

// Employee self-service
router.post('/sign-in', authorize(...ALL), validate(signInSchema), controller.signIn);
router.post('/sign-out', authorize(...ALL), validate(signOutSchema), controller.signOut);
router.get('/today', authorize(...ALL), controller.today);
router.get(
  '/monthly-summary',
  authorize(...ALL),
  validate(monthlySummaryQuerySchema, 'query'),
  controller.monthlySummary
);
router.get(
  '/range-summary',
  authorize(...ALL),
  validate(rangeSummaryQuerySchema, 'query'),
  controller.rangeSummary
);

// Admin/HR views
router.get('/', authorize(...ALL), validate(listQuerySchema, 'query'), controller.list);
router.get('/pending-regularizations', authorize(...MANAGERS_UP), controller.pendingRegularizations);

// Per-record operations
router.get(
  '/:id',
  authorize(...ALL),
  validate(idParamsSchema, 'params'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);

// Manual correction (HR/Super Admin only)
router.put(
  '/:id/correct',
  authorize(...HR_MANAGEMENT),
  validate(idParamsSchema, 'params'),
  validate(manualCorrectionSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.manualCorrection
);

// Regularization request (employee)
router.post(
  '/:id/regularize',
  authorize(...ALL),
  validate(idParamsSchema, 'params'),
  validate(regularizationRequestSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.requestRegularization
);

// Regularization review (HR/Manager)
router.patch(
  '/:id/regularize/review',
  authorize(...HR_MANAGEMENT, 'manager', 'team_lead'),
  validate(idParamsSchema, 'params'),
  validate(regularizationReviewSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.reviewRegularization
);

module.exports = router;
