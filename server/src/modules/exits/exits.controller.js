const service = require('./exits.service');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.submit = wrap(async (req, res) => res.status(201).json({ success: true, data: await service.submit(req.body, req.user) }));
exports.list = wrap(async (req, res) => res.json({ success: true, data: await service.list(req.query, req.user) }));
exports.review = wrap(async (req, res) => res.json({ success: true, data: await service.review(req.params.id, req.body, req.user) }));
exports.decide = wrap(async (req, res) => res.json({ success: true, data: await service.decide(req.params.id, req.body, req.user) }));
exports.clearance = wrap(async (req, res) => res.json({ success: true, data: await service.updateClearance(req.params.id, req.body, req.user) }));
exports.complete = wrap(async (req, res) => res.json({ success: true, data: await service.complete(req.params.id, req.user) }));
exports.withdraw = wrap(async (req, res) => res.json({ success: true, data: await service.withdraw(req.params.id, req.user) }));
