const express = require('express');
const controller = require('./holidays.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();
const ALL      = ['super_admin','admin','hr','manager','team_lead','employee'];
const ADMIN_HR = ['super_admin','admin','hr'];

router.use(authenticate);
router.get('/',    authorize(...ALL),    controller.list);
router.post('/',   authorize(...ADMIN_HR), controller.create);
router.put('/:id', authorize(...ADMIN_HR), controller.update);
router.delete('/:id', authorize(...ADMIN_HR), controller.remove);

module.exports = router;
