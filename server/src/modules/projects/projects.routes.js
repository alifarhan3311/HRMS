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
const callSaleController = require('./callSale.controller');
const Joi = require('joi');

const router = express.Router();
const ALLOWED_ROLES = ['manager', 'floor_head', 'team_lead', 'employee'];
const MANAGE_ROLES = ['manager'];

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
    details: Joi.string().trim().max(2000).allow('').optional(),
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
router.get('/call-sales/context', authorize(...ALLOWED_ROLES), callSaleController.context);
router.get('/call-sales', authorize(...ALLOWED_ROLES), callSaleController.list);
router.post(
  '/call-sales',
  authorize('employee', 'team_lead', 'floor_head'),
  validate(Joi.object({
    saleDate: Joi.string().isoDate().required(),
    businessName: Joi.string().trim().min(2).max(150).required(),
    ownerName: Joi.string().trim().min(2).max(150).required(),
    details: Joi.string().trim().max(2000).allow('').optional(),
    product: Joi.string().valid('pos', 'atm_service', 'accounting', 'osap', 'digital_media_service', 'pr', 'insurance').required(),
  })),
  callSaleController.create
);
router.patch(
  '/call-sales/:id/decision',
  authorize('team_lead', 'floor_head', 'manager'),
  validate(idParamsSchema, 'params'),
  validate(Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    reason: Joi.string().trim().max(500).allow('').optional(),
  })),
  callSaleController.decide
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
  authorize('manager'),
  validate(idParamsSchema, 'params'),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.remove
);

module.exports = router;
