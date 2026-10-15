const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const service = require('./rules.service');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.use(authenticate);
router.get('/', wrap(async (req, res) => res.json({ success: true, items: await service.list(req.user) })));
router.post('/', authorize('hr'), wrap(async (req, res) => res.status(201).json({ success: true, data: await service.create(req.body, req.user) })));
router.put('/:id', authorize('hr'), wrap(async (req, res) => res.json({ success: true, data: await service.change(req.params.id, req.body, req.user) })));
router.delete('/:id', authorize('hr'), wrap(async (req, res) => {
  await service.change(req.params.id, req.body, req.user, true);
  res.json({ success: true });
}));
module.exports = router;
