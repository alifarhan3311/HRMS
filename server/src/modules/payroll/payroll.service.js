/**
 * modules/payroll/payroll.service.js
 * Payroll calculation engine:
 *  - Generate payslip from employee salary + attendance data
 *  - Salary breakdown: basic + allowances - deductions + bonus + incentives
 *  - Deductions: absence penalty, late deductions, loan, advance, tax
 *  - Approval workflow: draft → pending_approval → approved → paid → locked
 */
const createHttpError = require('http-errors');
const repository = require('./payroll.repository');
const Employee = require('../employees/employees.model');
const Attendance = require('../attendance/attendance.model');
const LeaveRequest = require('../leaves/leaves.model');
const settingsService = require('../companySettings/companySettings.service');
const notificationService = require('../notifications/notifications.service');

async function notifyEmployee(record, type, title, message, suffix) {
  const employeeId = record.employeeId?._id || record.employeeId;
  await notificationService.createNotification({
    recipientId: employeeId,
    companyId: record.companyId,
    type,
    title,
    message,
    link: '/payroll',
    metadata: { payslipId: record._id, month: record.month, year: record.year },
    dedupeKey: `payslip-${suffix}:${record._id}`,
  });
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calculateAttendancePayroll({
  basicSalary, workingDays, absent, halfDay, late, unpaidLeave,
  requiredMinutes = 480, lateMinutes = 0, payrollPolicy = {},
}) {
  const perDaySalary = workingDays ? Number(basicSalary) / workingDays : 0;
  const requiredHours = Number(requiredMinutes || 480) / 60;
  const perHourSalary = requiredHours ? perDaySalary / requiredHours : 0;
  const mode = payrollPolicy.lateDeductionMode || 'three_lates_half_day';
  const lateGroups = Math.floor(Number(late || 0) / Number(payrollPolicy.latesPerHalfDay || 3));
  const lateDeductionDays = mode === 'per_minute' ? 0 : lateGroups * 0.5;
  const lateDeduction = mode === 'per_minute'
    ? Math.round(Number(lateMinutes || 0) * Number(payrollPolicy.perMinuteRate || 0))
    : Math.round(perDaySalary * lateDeductionDays);
  return {
    perDaySalary,
    perHourSalary,
    absenceDeduction: Math.round(perDaySalary * Number(absent || 0)),
    halfDayDeduction: Math.round(perDaySalary * Number(halfDay || 0) * 0.5),
    lateDeductionDays,
    lateDeduction,
    unpaidLeaveDeduction: Math.round(perDaySalary * Number(unpaidLeave || 0)),
  };
}

function calcTaxDeduction(gross) {
  // Simplified Pakistani income tax slab (annual income basis)
  // These are approximations — a real system would use exact FBR slabs
  const annual = gross * 12;
  let annualTax = 0;
  if (annual <= 600000) annualTax = 0;
  else if (annual <= 1200000) annualTax = (annual - 600000) * 0.025;
  else if (annual <= 2400000) annualTax = 15000 + (annual - 1200000) * 0.125;
  else if (annual <= 3600000) annualTax = 165000 + (annual - 2400000) * 0.20;
  else annualTax = 405000 + (annual - 3600000) * 0.25;
  return Math.round(annualTax / 12);
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthBounds(month, year) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

function leaveDutyDates(leave) {
  if (leave.dutyDates?.length) return leave.dutyDates;
  const dates = [];
  const cursor = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  while (cursor <= end) {
    dates.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function getAttendanceData(employee, month, year) {
  const { start, end } = monthBounds(month, year);
  const [records, approvedLeaves] = await Promise.all([
    Attendance.find({ employeeId: employee._id, date: { $gte: start, $lte: end } }),
    LeaveRequest.find({
      employeeId: employee._id,
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    }).select('leaveType startDate endDate dutyDates'),
  ]);
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const lateMinutes = records.reduce((sum, record) => sum + Number(record.lateMinutes || 0), 0);
  const halfDay = records.filter(r => r.status === 'half_day').length;
  const holiday = records.filter(r => r.status === 'holiday').length;
  const weekend = records.filter(r => r.status === 'weekend').length;
  const workedMinutes = records.reduce((sum, record) => sum + Number(record.workedMinutes || 0), 0);
  const paidLeaveDates = new Set();
  const unpaidLeaveDates = new Set();
  for (const leave of approvedLeaves) {
    for (const dutyDate of leaveDutyDates(leave)) {
      if (dutyDate < dateKey(start) || dutyDate > dateKey(end)) continue;
      (leave.leaveType === 'unpaid' ? unpaidLeaveDates : paidLeaveDates).add(dutyDate);
    }
  }
  for (const date of unpaidLeaveDates) paidLeaveDates.delete(date);

  const workingDayNumbers = employee.shiftId?.workingDays?.length
    ? employee.shiftId.workingDays
    : [1, 2, 3, 4, 5];
  let workingDays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (workingDayNumbers.includes(cur.getUTCDay())) workingDays++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return {
    present, absent, late, lateMinutes, halfDay, holiday, weekend, workingDays,
    paidLeave: paidLeaveDates.size,
    unpaidLeave: unpaidLeaveDates.size,
    workedMinutes,
  };
}

// ─── Generate / Create ────────────────────────────────────────────────────────
async function generatePayslip(payload, actor) {
  const { employeeId, month, year, allowanceItems = [], bonus = 0, incentives = 0,
    loanDeduction = 0, advanceSalary = 0, notes } = payload;

  // Check duplicate
  const existing = await repository.findByEmployeeAndPeriod(employeeId, month, year);
  if (existing) throw createHttpError(409, `Payslip for ${month}/${year} already exists for this employee.`);

  const employee = await Employee.findOne({ _id: employeeId, companyId: actor.companyId }).populate('shiftId');
  if (!employee) throw createHttpError(404, 'Employee not found.');

  const basicSalary = Number(employee.currentSalary) || 0;
  if (basicSalary <= 0) throw createHttpError(422, 'Employee salary must be configured before generating payroll.');
  const attendance = await getAttendanceData(employee, month, year);
  const {
    present, absent, late, lateMinutes, halfDay, paidLeave, unpaidLeave, holiday, weekend,
    workingDays, workedMinutes,
  } = attendance;

  // Allowances
  const allowanceTotal = allowanceItems.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // Deductions
  const settings = await settingsService.getPolicy(actor.companyId);
  const calculation = calculateAttendancePayroll({
    basicSalary,
    workingDays,
    absent,
    halfDay,
    late,
    unpaidLeave,
    requiredMinutes: employee.shiftId?.requiredMinutes,
    lateMinutes,
    payrollPolicy: settings.payrollPolicy,
  });
  const {
    perDaySalary, perHourSalary, absenceDeduction, halfDayDeduction,
    lateDeductionDays, lateDeduction, unpaidLeaveDeduction,
  } = calculation;
  const deductionItems = [
    { label: 'Absence Deduction', amount: absenceDeduction },
    { label: 'Half Day Deduction', amount: halfDayDeduction },
    { label: `Late Deduction (${lateDeductionDays} day)`, amount: lateDeduction },
    { label: 'Unpaid Leave Deduction', amount: unpaidLeaveDeduction },
    { label: 'Loan', amount: Number(loanDeduction) || 0 },
    { label: 'Advance Salary', amount: Number(advanceSalary) || 0 },
  ].filter(d => d.amount > 0);

  const deductionTotal = deductionItems.reduce((s, d) => s + d.amount, 0);
  const grossSalary = basicSalary + allowanceTotal + Number(bonus) + Number(incentives);
  const taxDeduction = calcTaxDeduction(grossSalary);
  const netSalary = Math.max(0, grossSalary - deductionTotal - taxDeduction);

  const payslip = await repository.create({
    employeeId,
    month,
    year,
    basicSalary: String(basicSalary),
    grossSalary: String(grossSalary),
    netSalary: String(netSalary),
    allowanceItems,
    allowances: allowanceTotal,
    deductionItems,
    deductions: deductionTotal,
    taxDeduction,
    bonus: Number(bonus) || 0,
    incentives: Number(incentives) || 0,
    loanDeduction: Number(loanDeduction) || 0,
    advanceSalary: Number(advanceSalary) || 0,
    presentDays: present,
    absentDays: absent,
    lateDays: late,
    halfDays: halfDay,
    paidLeaveDays: paidLeave,
    unpaidLeaveDays: unpaidLeave,
    holidayDays: holiday,
    weekendDays: weekend,
    workingDays,
    workedMinutes,
    perDaySalary: Math.round(perDaySalary),
    perHourSalary: Math.round(perHourSalary),
    absenceDeduction,
    halfDayDeduction,
    lateDeduction,
    unpaidLeaveDeduction,
    status: 'draft',
    notes: notes || '',
    companyId: actor.companyId,
  });

  return payslip.toObject({ getters: true });
}

// ─── Update payslip (before approval) ────────────────────────────────────────
async function updatePayslip(id, payload, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (['approved', 'paid', 'locked'].includes(record.status)) {
    throw createHttpError(400, 'Cannot modify an approved or locked payslip.');
  }
  const updated = await repository.updateById(id, payload);
  return updated.toObject({ getters: true });
}

// ─── Workflow ─────────────────────────────────────────────────────────────────
async function submitForApproval(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (record.status !== 'draft') throw createHttpError(400, 'Only draft payslips can be submitted.');
  const updated = await repository.updateById(id, { status: 'pending_approval' });
  return updated.toObject({ getters: true });
}

async function approvePayslip(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (record.status !== 'pending_approval') throw createHttpError(400, 'Payslip is not pending approval.');
  const updated = await repository.updateById(id, {
    status: 'approved', approvedBy: actor.id, approvedAt: new Date(),
  });
  await notifyEmployee(updated, 'payslip_approved', 'Payslip approved',
    `Your payslip for ${updated.month}/${updated.year} has been approved.`, 'approved');
  return updated.toObject({ getters: true });
}

async function markPaid(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (record.status !== 'approved') throw createHttpError(400, 'Only approved payslips can be marked paid.');
  const updated = await repository.updateById(id, { status: 'paid', paidAt: new Date() });
  await notifyEmployee(updated, 'salary_paid', 'Salary marked paid',
    `Your salary for ${updated.month}/${updated.year} has been marked paid.`, 'paid');
  return updated.toObject({ getters: true });
}

async function lockPayslip(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (record.status !== 'paid') throw createHttpError(400, 'Only paid payslips can be locked.');
  const updated = await repository.updateById(id, { status: 'locked' });
  await notifyEmployee(updated, 'payslip_locked', 'Payslip finalized',
    `Your payslip for ${updated.month}/${updated.year} has been finalized.`, 'locked');
  return updated.toObject({ getters: true });
}

// ─── List ────────────────────────────────────────────────────────────────────
async function listPayslips(query, actor) {
  const { page = 1, limit = 20, month, year, status, employeeId, sort = '-year -month' } = query;
  const filter = { companyId: actor.companyId };

  if (!['admin', 'super_admin', 'hr'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }
  if (status) filter.status = status;
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 100), sort });
}

async function getPayslipById(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  if (String(record.companyId) !== String(actor.companyId)) throw createHttpError(404, 'Payslip not found.');
  const employeeId = record.employeeId?._id || record.employeeId;
  if (!['admin', 'super_admin', 'hr'].includes(actor.role) && String(employeeId) !== String(actor.id)) {
    throw createHttpError(403, 'You can only view your own payslips.');
  }
  return record.toObject({ getters: true });
}

async function getLivePayroll(query, actor) {
  const now = new Date();
  const month = Number(query.month || now.getMonth() + 1);
  const year = Number(query.year || now.getFullYear());
  const employeeFilter = { companyId: actor.companyId, status: { $in: ['active', 'on_leave'] } };
  if (actor.role === 'manager') {
    employeeFilter.$or = [{ _id: actor.id }, { managerId: actor.id }];
  } else if (actor.role === 'team_lead') {
    employeeFilter.$or = [{ _id: actor.id }, { teamLeadId: actor.id }];
  } else if (!['admin', 'super_admin', 'hr'].includes(actor.role)) {
    employeeFilter._id = actor.id;
  }
  const [employees, settings] = await Promise.all([
    Employee.find(employeeFilter).populate('shiftId').sort({ fullName: 1 }),
    settingsService.getPolicy(actor.companyId),
  ]);
  const items = await Promise.all(employees.map(async (employee) => {
    const attendance = await getAttendanceData(employee, month, year);
    const basicSalary = Number(employee.currentSalary) || 0;
    const calculation = calculateAttendancePayroll({
      basicSalary,
      workingDays: attendance.workingDays,
      absent: attendance.absent,
      halfDay: attendance.halfDay,
      late: attendance.late,
      lateMinutes: attendance.lateMinutes,
      unpaidLeave: attendance.unpaidLeave,
      requiredMinutes: employee.shiftId?.requiredMinutes,
      payrollPolicy: settings.payrollPolicy,
    });
    const deductions = calculation.absenceDeduction + calculation.halfDayDeduction
      + calculation.lateDeduction + calculation.unpaidLeaveDeduction;
    const creditedDays = attendance.present + (attendance.halfDay * 0.5)
      + attendance.paidLeave + attendance.holiday;
    const earnedSalary = Math.min(basicSalary, Math.round(calculation.perDaySalary * creditedDays));
    return {
      employeeId: employee._id,
      employeeName: employee.fullName,
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      department: employee.department,
      monthlySalary: basicSalary,
      dailySalary: Math.round(calculation.perDaySalary),
      earnedSalary,
      deductions,
      netPayable: Math.max(0, basicSalary - deductions),
      month,
      year,
      ...attendance,
      ...calculation,
    };
  }));
  return { items, month, year, total: items.length };
}

module.exports = {
  generatePayslip, updatePayslip, listPayslips, getPayslipById,
  submitForApproval, approvePayslip, markPaid, lockPayslip,
  calculateAttendancePayroll, getLivePayroll,
};
