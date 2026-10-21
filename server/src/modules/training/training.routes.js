const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const service = require('./training.service');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const VIEW_ROLES = ['employee', 'team_lead', 'floor_head', 'manager', 'admin', 'hr', 'super_admin'];
const MANAGE_ROLES = ['admin', 'hr', 'super_admin'];

router.use(authenticate);
router.get('/', authorize(...VIEW_ROLES), wrap(async (req, res) => res.json({ success: true, items: await service.list(req.user) })));
router.post('/', authorize(...MANAGE_ROLES), wrap(async (req, res) => res.status(201).json({ success: true, data: await service.create(req.body, req.user) })));
router.put('/:id', authorize(...MANAGE_ROLES), wrap(async (req, res) => res.json({ success: true, data: await service.change(req.params.id, req.body, req.user) })));
router.delete('/:id', authorize(...MANAGE_ROLES), wrap(async (req, res) => {
  await service.change(req.params.id, req.body, req.user, true);
  res.json({ success: true });
}));

module.exports = router;
