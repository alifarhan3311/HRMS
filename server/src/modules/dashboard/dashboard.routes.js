/**
 * modules/dashboard/dashboard.routes.js
 */
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./dashboard.controller');

const router = Router();

router.get('/summary', authenticate, controller.getSummary);

module.exports = router;
