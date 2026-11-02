const createHttpError = require('http-errors');
const DAY_MS = 24 * 60 * 60 * 1000;

function buildPayrollPeriod({ joiningDate, monthlySalary, month, year }) {
  if (!Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createHttpError(400, 'Select a valid payroll month and year.');
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const end = new Date(lastDay.getTime() + DAY_MS - 1);
  let joiningDay = joiningDate ? new Date(joiningDate) : null;
  if (joiningDay && Number.isNaN(joiningDay.getTime())) {
    throw createHttpError(422, 'Employee joining date must be corrected before calculating payroll.');
  }
  if (joiningDay) joiningDay.setUTCHours(0, 0, 0, 0);
  const start = joiningDay && joiningDay > monthStart ? joiningDay : monthStart;
  const employedDuringPeriod = start <= lastDay;
  const applied = Boolean(joiningDay && joiningDay > monthStart);
  const eligibleDays = employedDuringPeriod ? Math.round((lastDay - start) / DAY_MS) + 1 : 0;
  // Existing payroll uses a fixed salary / 30 daily rate. A full month is
  // always 30 salary days; partial months use inclusive calendar days,
  // including ordinary weekly offs, capped at one full month's salary.
  const salaryDays = applied ? Math.min(30, eligibleDays) : 30;
  return {
    start, end, employedDuringPeriod,
    periodBasicSalary: salaryDays === 30
      ? Number(monthlySalary || 0)
      : Math.round(Number(monthlySalary || 0) * salaryDays / 30),
    salaryProration: {
      applied,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: lastDay.toISOString().slice(0, 10),
      eligibleDays, salaryDays, basisDays: 30,
    },
  };
}

module.exports = { buildPayrollPeriod };
