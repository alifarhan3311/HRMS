const service = require('./shifts.service');
const fn = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const list = fn(async (req, res) => res.json({ success: true, data: await service.listShifts(req.user, req.query) }));
const create = fn(async (req, res) => res.status(201).json({ success: true, data: await service.createShift(req.body, req.user) }));
const update = fn(async (req, res) => res.json({ success: true, data: await service.updateShift(req.params.id, req.body, req.user) }));
const remove = fn(async (req, res) => res.json({ success: true, ...(await service.deleteShift(req.params.id, req.user)) }));

module.exports = { list, create, update, remove };
