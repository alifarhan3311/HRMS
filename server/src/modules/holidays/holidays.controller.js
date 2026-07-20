const service = require('./holidays.service');
const fn = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

const list   = fn(async (req, res) => { res.json({ success: true, data: await service.listHolidays(req.query, req.user) }); });
const create = fn(async (req, res) => { res.status(201).json({ success: true, data: await service.createHoliday(req.body, req.user) }); });
const manualOff = fn(async (req, res) => { res.status(201).json({ success: true, data: await service.createManualCompanyOff(req.body, req.user) }); });
const syncCanada = fn(async (req, res) => { res.json({ success: true, data: await service.syncCanadaCalendar(req.body, req.user) }); });
const update = fn(async (req, res) => { res.json({ success: true, data: await service.updateHoliday(req.params.id, req.body, req.user) }); });
const decide = fn(async (req, res) => { res.json({ success: true, data: await service.decideHoliday(req.params.id, req.body, req.user) }); });
const remove = fn(async (req, res) => { res.json({ success: true, ...(await service.deleteHoliday(req.params.id, req.user)) }); });

module.exports = { list, create, manualOff, syncCanada, update, decide, remove };
