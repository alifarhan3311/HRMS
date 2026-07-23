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
  const shiftType = payload.shiftType || existing.shiftType || 'fixed';
  const breakMinutes = Number(payload.breakMinutes ?? existing.breakMinutes ?? 0);
  const isFlexible = shiftType === 'flexible';
  const requestedFlexibleMinutes = Number(payload.requiredMinutes ?? existing.requiredMinutes ?? 480);
  if (isFlexible && payload.requiredMinutes !== undefined && ![360, 480].includes(requestedFlexibleMinutes)) {
    throw createHttpError(422, 'Flexible shifts can only require 6 or 8 hours.');
  }
  const flexibleMinutes = [360, 480].includes(requestedFlexibleMinutes) ? requestedFlexibleMinutes : 480;
  const startTime = isFlexible ? '00:00' : (payload.startTime || existing.startTime);
  const endTime = isFlexible ? (flexibleMinutes === 360 ? '06:00' : '08:00') : (payload.endTime || existing.endTime);
  const windowMinutes = shiftWindowMinutes(startTime, endTime);
  const requiredMinutes = isFlexible ? flexibleMinutes : Math.max(60, windowMinutes - breakMinutes);
  const graceMinutes = isFlexible ? 0 : (windowMinutes > 420 ? 15 : 0);
  const lateHalfDayAfterMinutes = isFlexible ? 0 : (windowMinutes > 420 ? 150 : 120);
  const halfDayMinutes = Math.ceil(requiredMinutes / 2);
  const overtimeAfterMinutes = requiredMinutes;
  if (!isFlexible && requiredMinutes + breakMinutes > windowMinutes) {
    throw createHttpError(422, 'Required duty plus break time cannot exceed the shift window.');
  }
  return {
    ...payload,
    shiftType,
    startTime,
    endTime,
    requiredMinutes,
    breakMinutes: isFlexible ? 0 : breakMinutes,
    graceMinutes,
    lateHalfDayAfterMinutes,
    halfDayMinutes,
    overtimeAfterMinutes,
  };
}

async function listShifts(actor, { active } = {}) {
  const existingCount = await Shift.countDocuments({ companyId: actor.companyId });
  if (existingCount === 0) {
    try {
      await Shift.insertMany([
        { ...normalizeDurationPolicy({ name: 'Day Shift', code: 'DAY', shiftType: 'fixed', startTime: '09:00', endTime: '17:00', workingDays: [1, 2, 3, 4, 5] }), companyId: actor.companyId, createdBy: actor.id },
        { ...normalizeDurationPolicy({ name: 'Evening Shift', code: 'EVENING', shiftType: 'fixed', startTime: '18:00', endTime: '02:00', workingDays: [1, 2, 3, 4, 5] }), companyId: actor.companyId, createdBy: actor.id },
        { ...normalizeDurationPolicy({ name: 'Night Shift', code: 'NIGHT', shiftType: 'fixed', startTime: '21:00', endTime: '05:00', workingDays: [1, 2, 3, 4, 5] }), companyId: actor.companyId, createdBy: actor.id },
      ]);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  const filter = { companyId: actor.companyId };
  if (active !== undefined) filter.isActive = active === true || active === 'true';
  const shifts = await Shift.find(filter).sort({ startTime: 1, name: 1 });
  const policyFields = [
    'shiftType', 'requiredMinutes', 'breakMinutes', 'graceMinutes',
    'lateHalfDayAfterMinutes', 'halfDayMinutes', 'overtimeAfterMinutes',
  ];
  const updates = shifts.flatMap((shift) => {
    const normalized = normalizeDurationPolicy({}, shift);
    const changed = policyFields.some(field => Number.isFinite(Number(normalized[field]))
      ? Number(shift[field]) !== Number(normalized[field])
      : shift[field] !== normalized[field]);
    Object.assign(shift, normalized);
    return changed ? [{
      updateOne: {
        filter: { _id: shift._id },
        update: { $set: normalized },
      },
    }] : [];
  });
  // Legacy shifts are migrated once; normal list reads remain read-only.
  if (updates.length) await Shift.bulkWrite(updates);
  return shifts.map(shift => shift.toObject());
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

module.exports = { listShifts, createShift, updateShift, deleteShift, normalizeDurationPolicy };
