const express = require('express');
const controller = require('./auditLogs.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { listQuerySchema } = require('./auditLogs.validation');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'admin', 'hr'));
router.get('/', validate(listQuerySchema, 'query'), controller.list);

module.exports = router;
