const Holiday = require('../holidays/holidays.model');
const { boundaryForShiftDate } = require('./shiftTime');

function dateRange(shiftDate) {
  const start = new Date(`${shiftDate}T00:00:00.000Z`);
  const end = new Date(`${shiftDate}T23:59:59.999Z`);
  return { start, end };
}

function appliesToEmployee(closure, employee) {
  if (!closure || closure.affectedScope === 'all' || !closure.affectedScope) return true;
  if (closure.affectedScope === 'department') {
    return String(employee.department || '').trim().toLowerCase()
      === String(closure.affectedDepartment || '').trim().toLowerCase();
  }
  if (closure.affectedScope === 'shift') {
    return String(employee.shiftId?._id || employee.shiftId || '') === String(closure.affectedShiftId || '');
  }
  return false;
}

async function findClosure(employee, companyId, shiftDate) {
  const { start, end } = dateRange(shiftDate);
  const candidates = await Holiday.find({
    companyId,
    status: 'confirmed',
    date: { $gte: start, $lte: end },
  }).lean();
  return candidates.find((closure) => appliesToEmployee(closure, employee)) || null;
}

function shiftPolicy(shift = {}) {
  const requiredMinutes = Number(shift.requiredMinutes || 480);
  return {
    requiredMinutes,
    breakMinutes: Number(shift.breakMinutes || 0),
    halfDayMinutes: Number(shift.halfDayMinutes || Math.ceil(requiredMinutes / 2)),
    overtimeAfterMinutes: Number(shift.overtimeAfterMinutes || requiredMinutes),
  };
}

function effectivePolicy(closure, shift, schedule) {
  const base = shiftPolicy(shift);
  if (!closure) return { ...base, effectiveRequiredMinutes: base.requiredMinutes, effectiveHalfDayMinutes: base.halfDayMinutes, effectiveStart: schedule.scheduledStart, effectiveEnd: schedule.scheduledEnd };

  if (closure.eventType === 'full_day' || !closure.eventType) {
    return { ...base, effectiveRequiredMinutes: 0, effectiveHalfDayMinutes: 0, effectiveStart: schedule.scheduledStart, effectiveEnd: schedule.scheduledStart };
  }

  let effectiveStart = schedule.scheduledStart;
  let effectiveEnd = schedule.scheduledEnd;
  if (closure.eventType === 'early_closure' && closure.effectiveTime) {
    effectiveEnd = boundaryForShiftDate(schedule.shiftDate, closure.effectiveTime, shift, schedule);
  }
  if (closure.eventType === 'late_opening' && closure.effectiveTime) {
    effectiveStart = boundaryForShiftDate(schedule.shiftDate, closure.effectiveTime, shift, schedule);
  }

  const windowMinutes = Math.max(0, Math.round((effectiveEnd - effectiveStart) / 60000));
  let effectiveRequiredMinutes = closure.eventType === 'half_day'
    ? Math.ceil(base.requiredMinutes / 2)
    : Math.min(base.requiredMinutes, Math.max(0, windowMinutes - base.breakMinutes));
  if (closure.requiredMinutesOverride !== null && closure.requiredMinutesOverride !== undefined) {
    effectiveRequiredMinutes = Number(closure.requiredMinutesOverride);
  }
  return {
    ...base,
    effectiveRequiredMinutes,
    effectiveHalfDayMinutes: Math.ceil(effectiveRequiredMinutes / 2),
    effectiveStart,
    effectiveEnd,
  };
}

module.exports = { appliesToEmployee, findClosure, shiftPolicy, effectivePolicy };
