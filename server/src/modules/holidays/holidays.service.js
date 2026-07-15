/**
 * modules/holidays/holidays.service.js
 */
const createHttpError = require('http-errors');
const Holiday = require('./holidays.model');

async function listHolidays(query, actor) {
  const filter = { companyId: actor.companyId };
  if (query.year) {
    filter.date = {
      $gte: new Date(query.year, 0, 1),
      $lte: new Date(query.year, 11, 31, 23, 59, 59),
    };
  }
  return Holiday.find(filter).sort('date').lean();
}

async function createHoliday(payload, actor) {
  const exists = await Holiday.findOne({ companyId: actor.companyId, date: new Date(payload.date) });
  if (exists) throw createHttpError(409, 'A holiday already exists on this date.');
  return Holiday.create({ ...payload, companyId: actor.companyId });
}

async function updateHoliday(id, payload) {
  const updated = await Holiday.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) throw createHttpError(404, 'Holiday not found.');
  return updated;
}

async function deleteHoliday(id) {
  const deleted = await Holiday.findByIdAndDelete(id);
  if (!deleted) throw createHttpError(404, 'Holiday not found.');
  return { message: 'Holiday deleted.' };
}

module.exports = { listHolidays, createHoliday, updateHoliday, deleteHoliday };
