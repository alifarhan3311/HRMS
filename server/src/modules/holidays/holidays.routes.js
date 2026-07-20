const express = require('express');
const controller = require('./holidays.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const validation = require('./holidays.validation');

const router = express.Router();
const ALL      = ['super_admin','admin','hr','manager','team_lead','employee'];
const HR = ['super_admin','hr'];

router.use(authenticate);
router.get('/',    authorize(...ALL),    controller.list);
router.post('/sync-canada', authorize(...HR), validate(validation.syncSchema), controller.syncCanada);
router.post('/manual-off', authorize(...HR), validate(validation.createSchema), controller.manualOff);
router.post('/', authorize(...HR), validate(validation.createSchema), controller.create);
router.patch('/:id/decision', authorize(...HR), validate(validation.decisionSchema), controller.decide);
router.put('/:id', authorize(...HR), validate(validation.updateSchema), controller.update);
router.delete('/:id', authorize(...HR), controller.remove);

module.exports = router;
