const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const controller = require('./actionCenter.controller');
router.get('/', authenticate, authorize('hr', 'super_admin'), controller.get);
module.exports = router;
