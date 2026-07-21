const createHttpError = require('http-errors');
const Shift = require('./shifts.model');
const Employee = require('../employees/employees.model');

function shiftWindowMinutes(startTime, endTime) {
  const toMinutes = value => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  let duration = toMinutes(endTime) - toMinutes(startTime);
  if (duration <= 0) duration += 1440;
  return duration;
}

function normalizeDurationPolicy(payload, existing = {}) {
  const startTime = payload.startTime || existing.startTime;
  const endTime = payload.endTime || existing.endTime;
  const windowMinutes = shiftWindowMinutes(startTime, endTime);
  const breakMinutes = Number(payload.breakMinutes ?? existing.breakMinutes ?? 0);
  const requiredMinutes = Number(payload.requiredMinutes ?? existing.requiredMinutes ?? (windowMinutes - breakMinutes));
  const halfDayMinutes = Number(payload.halfDayMinutes ?? existing.halfDayMinutes ?? Math.ceil(requiredMinutes / 2));
  const overtimeAfterMinutes = Number(payload.overtimeAfterMinutes ?? existing.overtimeAfterMinutes ?? requiredMinutes);
  if (requiredMinutes + breakMinutes > windowMinutes) {
    throw createHttpError(422, 'Required duty plus break time cannot exceed the shift window.');
  }
  if (halfDayMinutes > requiredMinutes) {
    throw createHttpError(422, 'Half-day threshold cannot exceed required duty minutes.');
  }
  if (overtimeAfterMinutes < requiredMinutes) {
    throw createHttpError(422, 'Overtime threshold cannot be less than required duty minutes.');
  }
  return { ...payload, requiredMinutes, breakMinutes, halfDayMinutes, overtimeAfterMinutes };
}

async function listShifts(actor, { active } = {}) {
  const existingCount = await Shift.countDocuments({ companyId: actor.companyId });
  if (existingCount === 0) {
    try {
      await Shift.insertMany([
        { name: 'Day Shift', code: 'DAY', startTime: '09:00', endTime: '17:00', graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], companyId: actor.companyId, createdBy: actor.id },
        { name: 'Evening Shift', code: 'EVENING', startTime: '18:00', endTime: '02:00', graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], companyId: actor.companyId, createdBy: actor.id },
        { name: 'Night Shift', code: 'NIGHT', startTime: '21:00', endTime: '05:00', graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], companyId: actor.companyId, createdBy: actor.id },
      ]);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  const filter = { companyId: actor.companyId };
  if (active !== undefined) filter.isActive = active === true || active === 'true';
  return Shift.find(filter).sort({ startTime: 1, name: 1 }).lean();
}

async function createShift(payload, actor) {
  payload = normalizeDurationPolicy(payload);
  try {
    return await Shift.create({ ...payload, companyId: actor.companyId, createdBy: actor.id });
  } catch (error) {
    if (error?.code === 11000) throw createHttpError(409, 'A shift with this code already exists.');
    throw error;
  }
}

async function updateShift(id, payload, actor) {
  const existing = await Shift.findOne({ _id: id, companyId: actor.companyId });
  if (!existing) throw createHttpError(404, 'Shift not found.');
  payload = normalizeDurationPolicy(payload, existing);
  const shift = await Shift.findOneAndUpdate(
    { _id: id, companyId: actor.companyId },
    { $set: payload },
    { new: true, runValidators: true }
  );
  return shift;
}

async function deleteShift(id, actor) {
  const assigned = await Employee.countDocuments({ companyId: actor.companyId, shiftId: id });
  if (assigned) throw createHttpError(409, `This shift is assigned to ${assigned} employee(s). Reassign them before deleting it.`);
  const shift = await Shift.findOneAndDelete({ _id: id, companyId: actor.companyId });
  if (!shift) throw createHttpError(404, 'Shift not found.');
  return { message: 'Shift deleted.' };
}

module.exports = { listShifts, createShift, updateShift, deleteShift };
