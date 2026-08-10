const express = require('express');
const controller = require('./assets.controller');
const validation = require('./assets.validation');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();
const VIEW_ROLES = ['employee', 'team_lead', 'floor_head', 'manager', 'admin', 'hr', 'super_admin'];
const MANAGE_ROLES = ['admin', 'hr', 'super_admin'];

router.use(authenticate);
router.get('/dashboard', authorize(...VIEW_ROLES), controller.dashboard);
router.get('/employee/:employeeId', authorize(...VIEW_ROLES), controller.employeeAssets);
router.get('/', authorize(...VIEW_ROLES), controller.list);
router.post('/', authorize(...MANAGE_ROLES), validate(validation.createSchema), controller.create);
router.get('/:id', authorize(...VIEW_ROLES), controller.detail);
router.patch('/:id', authorize(...MANAGE_ROLES), validate(validation.updateSchema), controller.update);
router.post('/:id/assign', authorize(...MANAGE_ROLES), validate(validation.assignSchema), controller.assign);
router.post('/:id/return', authorize(...MANAGE_ROLES), validate(validation.returnSchema), controller.returnAsset);
router.post('/:id/status', authorize(...MANAGE_ROLES), validate(validation.statusSchema), controller.status);
router.post('/:id/maintenance', authorize(...MANAGE_ROLES), validate(validation.maintenanceSchema), controller.addMaintenance);
router.patch('/:id/maintenance/:maintenanceId', authorize(...MANAGE_ROLES), validate(validation.maintenanceUpdateSchema), controller.updateMaintenance);

module.exports = router;
