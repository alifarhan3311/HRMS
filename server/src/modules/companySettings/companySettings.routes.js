const express = require('express');
const controller = require('./companySettings.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { updateSchema } = require('./companySettings.validation');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'hr'));
router.get('/', controller.get);
router.put('/', validate(updateSchema), controller.update);

module.exports = router;
