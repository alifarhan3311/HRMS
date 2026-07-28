const service = require('./callSale.service');
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const context = asyncHandler(async (req, res) => res.json({ success: true, data: await service.context(req.user) }));
const create = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.create(req.body, req.user) }));
const list = asyncHandler(async (req, res) => res.json({ success: true, data: await service.list(req.query, req.user) }));
const decide = asyncHandler(async (req, res) => res.json({ success: true, data: await service.decide(req.params.id, req.body, req.user) }));

module.exports = { context, create, list, decide };
