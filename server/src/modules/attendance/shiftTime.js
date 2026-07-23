function timeMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
    return result;
  }, {});
  return parts;
}

function zonedDateTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Two passes handle DST boundaries without adding a timezone dependency.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
    guess -= actualAsUtc - Date.UTC(year, month - 1, day, hour, minute, 0);
  }
  return new Date(guess);
}

function addCalendarDays(parts, amount) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function buildShiftSchedule(now, shift, timeZone) {
  const local = zonedParts(now, timeZone);
  const startMinutes = timeMinutes(shift.startTime);
  const endMinutes = timeMinutes(shift.endTime);
  const overnight = endMinutes <= startMinutes;
  const currentMinutes = (local.hour * 60) + local.minute;
  const afterMidnightWindow = overnight && currentMinutes <= endMinutes + 240;
  const workDate = afterMidnightWindow ? addCalendarDays(local, -1) : local;
  const nextDate = addCalendarDays(workDate, overnight ? 1 : 0);
  const [startHour, startMinute] = shift.startTime.split(':').map(Number);
  const [endHour, endMinute] = shift.endTime.split(':').map(Number);
  const scheduledStart = zonedDateTimeToUtc({ ...workDate, hour: startHour, minute: startMinute }, timeZone);
  const scheduledEnd = zonedDateTimeToUtc({ ...nextDate, hour: endHour, minute: endMinute }, timeZone);
  const shiftDate = `${workDate.year}-${String(workDate.month).padStart(2, '0')}-${String(workDate.day).padStart(2, '0')}`;
  const dayOfWeek = new Date(Date.UTC(workDate.year, workDate.month - 1, workDate.day, 12)).getUTCDay();
  return { shiftDate, scheduledStart, scheduledEnd, overnight, dayOfWeek, timeZone };
}

function buildFlexibleSchedule(now, shift, timeZone) {
  const local = zonedParts(now, timeZone);
  const shiftDate = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const requiredMinutes = Number(shift.requiredMinutes || 480);
  const breakMinutes = Number(shift.breakMinutes || 0);
  return {
    shiftDate,
    scheduledStart: new Date(now),
    scheduledEnd: new Date(now.getTime() + ((requiredMinutes + breakMinutes) * 60000)),
    overnight: false,
    dayOfWeek: new Date(Date.UTC(local.year, local.month - 1, local.day, 12)).getUTCDay(),
    timeZone,
  };
}

function lateMinutes(signInTime, schedule, graceMinutes = 0) {
  const deadline = new Date(schedule.scheduledStart.getTime() + graceMinutes * 60000);
  return signInTime <= deadline ? 0 : Math.round((signInTime - deadline) / 60000);
}

function arrivalStatus(signInTime, schedule, shift = {}) {
  if (shift.shiftType === 'flexible') return { status: 'present', lateMinutes: 0, arrivalMinutes: 0 };
  const arrivalMinutes = Math.max(
    0,
    Math.floor((signInTime - new Date(schedule.scheduledStart)) / 60000)
  );
  const late = lateMinutes(signInTime, schedule, Number(shift.graceMinutes || 0));
  return {
    status: arrivalMinutes > Number(shift.lateHalfDayAfterMinutes || 0)
      ? 'half_day'
      : late > 0 ? 'late' : 'present',
    lateMinutes: late,
    arrivalMinutes,
  };
}

function earlyLeaveMinutes(signOutTime, schedule) {
  return signOutTime >= schedule.scheduledEnd ? 0 : Math.round((schedule.scheduledEnd - signOutTime) / 60000);
}

function boundaryForShiftDate(shiftDate, time, shift, schedule) {
  const [year, month, day] = shiftDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const overnight = timeMinutes(shift.endTime) <= timeMinutes(shift.startTime);
  const boundaryIsNextDay = overnight && timeMinutes(time) < timeMinutes(shift.startTime);
  const date = boundaryIsNextDay ? addCalendarDays({ year, month, day }, 1) : { year, month, day };
  return zonedDateTimeToUtc({ ...date, hour, minute }, schedule.timeZone);
}

module.exports = { buildShiftSchedule, buildFlexibleSchedule, lateMinutes, arrivalStatus, earlyLeaveMinutes, boundaryForShiftDate };
