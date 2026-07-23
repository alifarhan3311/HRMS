/**
 * modules/payroll/payroll.routes.js
 */
const express = require('express');
const controller = require('./payroll.controller');
const repository = require('./payroll.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALL      = ['super_admin','admin','hr','manager','team_lead','employee'];
const PAYROLL_ADMINS = ['super_admin','admin'];
const ADMIN_HR = ['super_admin','admin','hr'];

router.use(authenticate);

// List & generate
router.get('/',    authorize(...ALL),    controller.list);
router.get('/live', authorize(...ALL), controller.live);
router.post('/',   authorize(...PAYROLL_ADMINS), controller.generate);

// Per-payslip
router.get('/:id',  authorize(...ALL),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById);

router.put('/:id',  authorize(...PAYROLL_ADMINS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.update);

// Workflow
router.patch('/:id/submit',   authorize(...PAYROLL_ADMINS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.submit);

router.patch('/:id/approve',  authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.approve);

router.patch('/:id/paid',     authorize(...PAYROLL_ADMINS),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.markPaid);

router.patch('/:id/lock',     authorize(...ADMIN_HR),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.lock);

module.exports = router;
