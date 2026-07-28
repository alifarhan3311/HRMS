/**
 * modules/leaves/leaves.routes.js
 */
const express = require('express');
const controller = require('./leaves.controller');
const repository = require('./leaves.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const validation = require('./leaves.validation');

const router = express.Router();
const ALL = ['super_admin', 'admin', 'hr', 'manager', 'floor_head', 'team_lead', 'employee'];
const APPROVERS = ['hr', 'manager', 'floor_head', 'team_lead'];

router.use(authenticate);

router.post('/', authorize(...ALL), validate(validation.createSchema), controller.apply);
router.get('/eligible-lates', authorize(...ALL), controller.eligibleLates);
router.post('/late-conversion', authorize(...ALL),
  validate(validation.lateConversionSchema),
  controller.applyLateConversion);
router.get('/', authorize(...ALL), controller.list);
router.get('/pending-approvals', authorize(...APPROVERS), controller.pendingApprovals);

router.get('/:id', authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

router.patch('/:id/approve', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  validate(validation.decisionSchema),
  controller.approve);

router.patch('/:id/reject', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  validate(validation.decisionSchema),
  controller.reject);

router.patch('/:id/cancel', authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  validate(validation.cancelSchema),
  controller.cancel);

module.exports = router;
