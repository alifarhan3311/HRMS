/**
 * modules/expenses/expenses.routes.js
 */
const express = require('express');
const controller = require('./expenses.controller');
const repository = require('./expenses.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALL       = ['super_admin','admin','hr','finance','manager','team_lead','employee'];
const APPROVERS = ['super_admin','admin','hr','finance','manager'];

router.use(authenticate);

router.post('/', authorize(...ALL),    controller.submit);
router.get('/',  authorize(...ALL),    controller.list);

router.get('/:id', authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

router.patch('/:id/approve', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.approve);

router.patch('/:id/reject', authorize(...APPROVERS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.reject);

router.patch('/:id/paid', authorize('super_admin','admin','finance'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.markPaid);

module.exports = router;
