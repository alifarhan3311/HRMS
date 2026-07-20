const express = require('express');
const controller = require('./shifts.controller');
const validate = require('../../middlewares/validate.middleware');
const validation = require('./shifts.validation');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize('super_admin', 'hr'), controller.list);
router.post('/', authorize('super_admin', 'hr'), validate(validation.createSchema), controller.create);
router.put('/:id', authorize('super_admin', 'hr'), validate(validation.updateSchema), controller.update);
router.delete('/:id', authorize('super_admin', 'hr'), controller.remove);

module.exports = router;
