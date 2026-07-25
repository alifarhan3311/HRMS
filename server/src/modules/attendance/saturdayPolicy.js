function isSaturdayShiftDate(shiftDate) {
  if (!shiftDate) return false;
  const date = new Date(`${shiftDate}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 6;
}

function saturdayStatus({ shiftDate, hasSignIn, isFullDayClosure = false }) {
  if (!isSaturdayShiftDate(shiftDate)) return null;
  if (isFullDayClosure) return 'holiday';
  return hasSignIn ? 'present' : 'absent';
}

module.exports = { isSaturdayShiftDate, saturdayStatus };
