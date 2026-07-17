const express = require('express');
const controller = require('./notifications.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { idParamsSchema, listQuerySchema } = require('./notifications.validation');

const router = express.Router();

router.use(authenticate);
router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.patch('/read-all', controller.markAllRead);
router.delete('/all', controller.clear);
router.patch('/:id/read', validate(idParamsSchema, 'params'), controller.markRead);
router.delete('/:id', validate(idParamsSchema, 'params'), controller.remove);

module.exports = router;
