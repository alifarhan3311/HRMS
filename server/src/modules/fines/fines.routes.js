/**
 * modules/fines/fines.routes.js
 */
const express = require('express');
const controller = require('./fines.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createFineSchema, voidFineSchema, listFinesSchema } = require('./fines.validation');

const router = express.Router();
const HR_ROLES = ['hr', 'super_admin'];

router.use(authenticate);

// Employee self-service: View own fines (accessible to all authenticated employees)
router.get('/my-fines', controller.myFines);

// Issue a new fine (HR/Super admin only)
router.post(
  '/',
  authorize(...HR_ROLES),
  validate(createFineSchema),
  controller.issue
);

// List all company fines (HR/Super admin only)
router.get(
  '/',
  authorize(...HR_ROLES),
  validate(listFinesSchema, 'query'),
  controller.list
);

// Get a single fine (HR/Super admin only)
router.get(
  '/:id',
  authorize(...HR_ROLES),
  controller.getById
);

// Void (soft-delete) a fine (HR/Super admin only)
router.patch(
  '/:id/void',
  authorize(...HR_ROLES),
  validate(voidFineSchema),
  controller.voidFine
);

module.exports = router;
