/**
 * modules/projects/projects.routes.js
 * Route wiring for the projects module: auth -> RBAC -> tenant-scope -> controller.
 */
const express = require('express');
const controller = require('./projects.controller');
const repository = require('./projects.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createSchema, updateSchema, idParamsSchema } = require('./projects.validation');
const callTransferController = require('./callTransfer.controller');
const Joi = require('joi');

const router = express.Router();
const ALLOWED_ROLES = ['admin','manager','floor_head','team_lead','super_admin','hr','employee'];
const MANAGE_ROLES = ['admin', 'manager', 'super_admin'];

router.use(authenticate);

router.get('/call-transfers/context', authorize(...ALLOWED_ROLES), callTransferController.context);
router.get('/call-transfers', authorize(...ALLOWED_ROLES), callTransferController.list);
router.post(
  '/call-transfers',
  authorize(...ALLOWED_ROLES),
  validate(Joi.object({
    transferredEmployeeId: Joi.string().hex().length(24).required(),
    transferDate: Joi.string().isoDate().required(),
    businessOwnerName: Joi.string().trim().min(2).max(150).required(),
  })),
  callTransferController.create
);
router.patch(
  '/call-transfers/:id/decision',
  authorize('team_lead'),
  validate(idParamsSchema, 'params'),
  validate(Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    reason: Joi.string().trim().max(500).allow('').optional(),
  })),
  callTransferController.decide
);
router.get('/', authorize(...ALLOWED_ROLES), controller.list);
router.get('/eligible-employees', authorize(...ALLOWED_ROLES), controller.eligibleEmployees);
router.post('/', authorize(...MANAGE_ROLES), validate(createSchema), controller.create);
router.get(
  '/:id',
  authorize(...ALLOWED_ROLES),
  validate(idParamsSchema, 'params'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);
router.put(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(idParamsSchema, 'params'),
  validate(updateSchema),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.update
);
router.delete(
  '/:id',
  authorize('admin', 'super_admin'),
  validate(idParamsSchema, 'params'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.remove
);

module.exports = router;
