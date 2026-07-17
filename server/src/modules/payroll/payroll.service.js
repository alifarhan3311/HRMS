/**
 * modules/payroll/payroll.service.js
 * Payroll calculation engine:
 *  - Generate payslip from employee salary + attendance data
 *  - Salary breakdown: basic + allowances - deductions + bonus + incentives + overtime
 *  - Deductions: absence penalty, late deductions, loan, advance, tax
 *  - Approval workflow: draft → pending_approval → approved → paid → locked
 */
const createHttpError = require('http-errors');
const repository = require('./payroll.repository');
const Employee = require('../employees/employees.model');
const Attendance = require('../attendance/attendance.model');
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

function calcAttendanceDeductions(basic, absentDays, workingDays) {
  if (!workingDays || !absentDays) return 0;
  const perDay = Number(basic) / workingDays;
  return Math.round(perDay * absentDays);
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

async function getAttendanceData(employeeId, month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const records = await Attendance.find({ employeeId, date: { $gte: start, $lte: end } });
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  // Working days = all weekdays in month
  let workingDays = 0;
  const cur = new Date(start);
  while (cur <= end) { if (cur.getDay() !== 0 && cur.getDay() !== 6) workingDays++; cur.setDate(cur.getDate() + 1); }
  return { present, absent, late, workingDays };
}

// ─── Generate / Create ────────────────────────────────────────────────────────
async function generatePayslip(payload, actor) {
  const { employeeId, month, year, allowanceItems = [], bonus = 0, incentives = 0,
    overtime = 0, loanDeduction = 0, advanceSalary = 0, notes } = payload;

  // Check duplicate
  const existing = await repository.findByEmployeeAndPeriod(employeeId, month, year);
  if (existing) throw createHttpError(409, `Payslip for ${month}/${year} already exists for this employee.`);

  const employee = await Employee.findById(employeeId);
  if (!employee) throw createHttpError(404, 'Employee not found.');

  const basicSalary = Number(employee.currentSalary) || 0;
  const { present, absent, late, workingDays } = await getAttendanceData(employeeId, month, year);

  // Allowances
  const allowanceTotal = allowanceItems.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // Deductions
  const absenceDeduction = calcAttendanceDeductions(basicSalary, absent, workingDays);
  const lateDeduction = Math.round(late * (basicSalary / workingDays / 8) * 1); // 1hr per late
  const deductionItems = [
    { label: 'Absence Deduction', amount: absenceDeduction },
    { label: 'Late Deduction', amount: lateDeduction },
    { label: 'Loan', amount: Number(loanDeduction) || 0 },
    { label: 'Advance Salary', amount: Number(advanceSalary) || 0 },
  ].filter(d => d.amount > 0);

  const deductionTotal = deductionItems.reduce((s, d) => s + d.amount, 0);
  const grossSalary = basicSalary + allowanceTotal + Number(bonus) + Number(incentives) + Number(overtime);
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
    overtime: Number(overtime) || 0,
    loanDeduction: Number(loanDeduction) || 0,
    advanceSalary: Number(advanceSalary) || 0,
    presentDays: present,
    absentDays: absent,
    lateDays: late,
    workingDays,
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

  if (!['admin', 'super_admin'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }
  if (status) filter.status = status;
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 100), sort });
}

async function getPayslipById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Payslip not found.');
  return record.toObject({ getters: true });
}

module.exports = {
  generatePayslip, updatePayslip, listPayslips, getPayslipById,
  submitForApproval, approvePayslip, markPaid, lockPayslip,
};
