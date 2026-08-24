function normalizeDepartment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isMonthlyHourDepartment(value) {
  const normalized = normalizeDepartment(value);
  return ['operations', 'accounting'].includes(normalized);
}

function roundHours(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buildMonthlyHoursSummary(records = [], { month, year, now = new Date(), targetHours = 184 } = {}) {
  const target = Number(targetHours || 184);
  const targetMinutes = target * 60;
  const completedMinutes = records.reduce((total, record) => (
    total + Number(record.workedMinutes || Math.round(Number(record.totalHours || 0) * 60) || 0)
  ), 0);
  const completedHours = roundHours(completedMinutes / 60);
  const remainingHours = Math.max(0, roundHours(target - completedHours));
  const shortHours = remainingHours;
  const extraHours = Math.max(0, roundHours(completedHours - target));
  const completionPercentage = target > 0
    ? Number(Math.min(100, ((completedHours / target) * 100)).toFixed(1))
    : 0;
  const targetMonth = Number(month || now.getMonth() + 1);
  const targetYear = Number(year || now.getFullYear());
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const monthStart = new Date(targetYear, targetMonth - 1, 1);
  const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
  const boundedNow = now < monthStart ? null : (now > monthEnd ? monthEnd : now);
  const daysElapsed = boundedNow ? Math.max(1, boundedNow.getDate()) : 0;
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const averageHoursPerDay = daysElapsed ? roundHours(completedHours / daysElapsed) : 0;
  const requiredAverageHoursPerRemainingDay = daysRemaining ? roundHours(remainingHours / daysRemaining) : 0;
  const projectedMonthlyTotal = daysElapsed ? roundHours(averageHoursPerDay * daysInMonth) : completedHours;
  let status = 'behind';
  if (completedHours >= target) status = 'target_completed';
  else if (extraHours > 0) status = 'ahead';
  else if (projectedMonthlyTotal >= target) status = 'on_track';

  const counts = records.reduce((acc, record) => {
    if (Object.prototype.hasOwnProperty.call(acc, record.status)) acc[record.status] += 1;
    return acc;
  }, {
    present: 0,
    late: 0,
    absent: 0,
    half_day: 0,
    incomplete: 0,
    on_leave: 0,
    holiday: 0,
    weekend: 0,
  });

  return {
    targetHours: target,
    targetMinutes,
    completedHours,
    completedMinutes,
    remainingHours,
    shortHours,
    extraHours,
    completionPercentage,
    daysElapsed,
    daysRemaining,
    daysInMonth,
    averageHoursPerDay,
    requiredAverageHoursPerRemainingDay,
    projectedMonthlyTotal,
    status,
    statusLabel: {
      target_completed: 'Target Completed',
      ahead: 'Ahead',
      on_track: 'On Track',
      behind: 'Behind',
    }[status] || 'Behind',
    ...counts,
  };
}

function calculateMonthlyHoursDeduction({ monthlySalary = 0, completedHours = 0, targetHours = 184 }) {
  const salary = Number(monthlySalary || 0);
  const perDaySalary = salary / 30;
  const perHourSalary = perDaySalary / 8;
  const target = Number(targetHours || 184);
  const shortHours = Math.max(0, target - Number(completedHours || 0));
  const attendanceDeduction = Math.round(shortHours * perHourSalary);
  return {
    perDaySalary,
    perHourSalary,
    attendanceDeduction,
    shortHours: roundHours(shortHours),
    shortDaysEquivalent: roundHours(shortHours / 8),
    netSalary: Math.max(0, Math.round(salary - attendanceDeduction)),
  };
}

module.exports = {
  MONTHLY_HOUR_TARGET: 184,
  isMonthlyHourDepartment,
  buildMonthlyHoursSummary,
  calculateMonthlyHoursDeduction,
  normalizeDepartment,
};
