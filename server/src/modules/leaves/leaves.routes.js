/**
 * modules/leaves/leaves.routes.js
 */
const express = require('express');
const controller = require('./leaves.controller');
const repository = require('./leaves.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALL = ['super_admin', 'admin', 'hr', 'manager', 'team_lead', 'employee'];
const APPROVERS = ['super_admin', 'hr', 'manager', 'team_lead'];

router.use(authenticate);

router.post('/', authorize(...ALL), controller.apply);
router.get('/', authorize(...ALL), controller.list);
router.get('/pending-approvals', authorize(...APPROVERS), controller.pendingApprovals);

router.get('/:id', authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

router.patch('/:id/approve', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.approve);

router.patch('/:id/reject', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.reject);

router.patch('/:id/cancel', authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.cancel);

module.exports = router;
