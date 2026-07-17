/**
 * modules/projects/projects.routes.js
 * Route wiring for the projects module: auth -> RBAC -> tenant-scope -> controller.
 */
const express = require('express');
const controller = require('./projects.controller');
const repository = require('./projects.repository');
const { authenticate, authorize, enforceTenantScope } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALLOWED_ROLES = ['admin','manager','team_lead','super_admin','hr','employee'];

router.use(authenticate);

router.get('/', authorize(...ALLOWED_ROLES), controller.list);
router.post('/', authorize(...ALLOWED_ROLES), controller.create);
router.get(
  '/:id',
  authorize(...ALLOWED_ROLES),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.getById
);
router.put(
  '/:id',
  authorize(...ALLOWED_ROLES),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.update
);
router.delete(
  '/:id',
  authorize(...ALLOWED_ROLES),
  enforceTenantScope(async (req) => repository.findById(req.params.id)),
  controller.remove
);

module.exports = router;
