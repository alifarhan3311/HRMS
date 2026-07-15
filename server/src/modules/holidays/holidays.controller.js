const service = require('./holidays.service');
const fn = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

const list   = fn(async (req, res) => { res.json({ success: true, data: await service.listHolidays(req.query, req.user) }); });
const create = fn(async (req, res) => { res.status(201).json({ success: true, data: await service.createHoliday(req.body, req.user) }); });
const update = fn(async (req, res) => { res.json({ success: true, data: await service.updateHoliday(req.params.id, req.body) }); });
const remove = fn(async (req, res) => { res.json({ success: true, ...(await service.deleteHoliday(req.params.id)) }); });

module.exports = { list, create, update, remove };
