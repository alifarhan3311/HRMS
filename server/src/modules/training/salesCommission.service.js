const createHttpError = require('http-errors');
const mongoose = require('mongoose');
const Employee = require('../employees/employees.model');
const Payslip = require('../payroll/payroll.model');
const TrainingCommission = require('./commission.model');
const SalesCommission = require('./salesCommission.model');
const commissionService = require('./commission.service');

function requireHr(actor) {
  if (actor?.role !== 'hr' || !actor.companyId) throw createHttpError(403, 'Only HR can manage monthly sales commissions.');
}

function requireEmployee(actor) {
  if (!actor?.companyId || !['employee', 'team_lead', 'floor_head', 'manager'].includes(actor.role)) {
    throw createHttpError(403, 'You cannot view this commission statement.');
  }
}

function normalizeDepartment(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return ['callcenter', 'callcentre'].includes(normalized);
}

function period(payload) {
  const month = Number(payload.month);
  const year = Number(payload.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createHttpError(400, 'Select a valid month and year.');
  }
  return { month, year, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
}

function shapeItems(commissions, entry = {}, previousItems = []) {
  const values = entry.products || {};
  return commissions.map(rate => {
    const input = values[rate.slug] || {};
    const snapshot = previousItems.find(item => item.slug === rate.slug);
    const effectiveRate = snapshot ? { ...rate, name: snapshot.name, unit: snapshot.unit, amount: snapshot.rate } : rate;
    const quantity = Number(input.quantity || 0);
    const salesAmount = effectiveRate.unit === 'percent' ? Number(input.salesAmount || 0) : 0;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) throw createHttpError(400, `Enter a whole quantity from 0 to 1,000,000 for ${effectiveRate.name}.`);
    if (!Number.isFinite(salesAmount) || salesAmount < 0 || salesAmount > 100000000000) throw createHttpError(400, `Enter a valid sales amount for ${effectiveRate.name}.`);
    const commissionAmount = effectiveRate.unit === 'percent'
      ? Math.round(salesAmount * Number(effectiveRate.amount)) / 100
      : Math.round(quantity * Number(effectiveRate.amount) * 100) / 100;
    return {
      commissionId: effectiveRate._id,
      slug: effectiveRate.slug,
      name: effectiveRate.name,
      unit: effectiveRate.unit,
      rate: Number(effectiveRate.amount),
      quantity,
      salesAmount,
      commissionAmount,
    };
  });
}

async function listPeriod(query, actor) {
  requireHr(actor);
  const { month, year, start, end } = period(query);
  const [employees, commissions] = await Promise.all([
    Employee.find({
      companyId: actor.companyId,
      status: { $in: ['active', 'on_leave', 'resigned'] },
      joiningDate: { $lte: end },
      $or: [{ exitDate: { $exists: false } }, { exitDate: null }, { exitDate: { $gte: start } }],
    }).select('fullName employeeCode department designation joiningDate exitDate status').sort({ fullName: 1 }).lean(),
    commissionService.list(actor),
  ]);
  const callCenterEmployees = employees.filter(employee => normalizeDepartment(employee.department));
  const records = await SalesCommission.find({ companyId: actor.companyId, month, year, employeeId: { $in: callCenterEmployees.map(employee => employee._id) } }).lean();
  const byEmployee = new Map(records.map(record => [String(record.employeeId), record]));
  return {
    month,
    year,
    commissions,
    employees: callCenterEmployees.map(employee => ({ ...employee, salesCommission: byEmployee.get(String(employee._id)) || null })),
  };
}

async function savePeriod(payload, actor) {
  requireHr(actor);
  const { month, year, start, end } = period(payload);
  if (!Array.isArray(payload.entries) || payload.entries.length > 1000) throw createHttpError(400, 'Invalid monthly commission entries.');
  const employeeIds = payload.entries.map(entry => String(entry.employeeId || ''));
  if (employeeIds.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(employeeIds).size !== employeeIds.length) {
    throw createHttpError(400, 'Each employee must appear once in the monthly entry.');
  }
  const [employees, commissions] = await Promise.all([
    Employee.find({ _id: { $in: employeeIds }, companyId: actor.companyId, status: { $in: ['active', 'on_leave', 'resigned'] }, joiningDate: { $lte: end }, $or: [{ exitDate: { $exists: false } }, { exitDate: null }, { exitDate: { $gte: start } }] }).select('department').lean(),
    commissionService.list(actor),
  ]);
  if (employees.length !== employeeIds.length || employees.some(employee => !normalizeDepartment(employee.department))) {
    throw createHttpError(400, 'Monthly sales can only be recorded for Call Center employees employed during the selected month.');
  }
  const finalizedPayslip = await Payslip.findOne({
    companyId: actor.companyId,
    employeeId: { $in: employeeIds },
    month,
    year,
    status: { $in: ['pending_approval', 'approved', 'paid', 'locked'] },
  }).select('_id').lean();
  if (finalizedPayslip) throw createHttpError(409, 'Commission sales are locked after payroll is submitted for approval.');

  const existingSales = await SalesCommission.find({ companyId: actor.companyId, employeeId: { $in: employeeIds }, month, year }).select('employeeId items').lean();
  const existingByEmployee = new Map(existingSales.map(record => [String(record.employeeId), record.items || []]));

  const saved = [];
  for (const entry of payload.entries) {
    const items = shapeItems(commissions, entry, existingByEmployee.get(String(entry.employeeId)) || []);
    const totalCommission = Math.round(items.reduce((sum, item) => sum + item.commissionAmount, 0) * 100) / 100;
    const record = await SalesCommission.findOneAndUpdate(
      { companyId: actor.companyId, employeeId: entry.employeeId, month, year },
      {
        $set: { items, totalCommission, updatedBy: actor.id },
        $setOnInsert: { companyId: actor.companyId, employeeId: entry.employeeId, month, year, createdBy: actor.id },
        $inc: { revision: 1 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    saved.push(record);
    await refreshDraftPayslip(record);
  }
  return { month, year, savedCount: saved.length };
}

async function refreshDraftPayslip(salesRecord) {
  const payslip = await Payslip.findOne({ companyId: salesRecord.companyId, employeeId: salesRecord.employeeId, month: salesRecord.month, year: salesRecord.year, status: 'draft' });
  if (!payslip) return;
  const commissionItems = salesRecord.items.filter(item => item.commissionAmount > 0).map(item => ({
    label: `${item.name} Commission`, name: item.name, amount: item.commissionAmount,
    quantity: item.quantity, salesAmount: item.salesAmount, rate: item.rate, unit: item.unit,
  }));
  const commissionTotal = commissionItems.reduce((sum, item) => sum + item.amount, 0);
  const grossSalary = Number(payslip.basicSalary || 0) + Number(payslip.allowances || 0)
    + Number(payslip.bonus || 0) + Number(payslip.incentives || 0) + commissionTotal;
  const netSalary = Math.max(0, grossSalary - Number(payslip.deductions || 0) - Number(payslip.taxDeduction || 0));
  payslip.commissionItems = commissionItems;
  payslip.commissionTotal = commissionTotal;
  payslip.grossSalary = String(grossSalary);
  payslip.netSalary = String(netSalary);
  await payslip.save();
}

function previousPeriod(month, year) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

async function getMine(query, actor) {
  requireEmployee(actor);
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId }).select('department').lean();
  if (!employee || !normalizeDepartment(employee.department)) throw createHttpError(403, 'Commission statements are available only to Call Center employees.');
  const selected = period(query);
  const prior = previousPeriod(selected.month, selected.year);
  const records = await SalesCommission.find({ companyId: actor.companyId, employeeId: actor.id, $or: [selected, prior].map(({ month, year }) => ({ month, year })) }).lean();
  const byPeriod = new Map(records.map(record => [`${record.year}-${record.month}`, record]));
  return [selected, prior].map(({ month, year }) => {
    const record = byPeriod.get(`${year}-${month}`);
    return { month, year, items: record?.items || [], totalCommission: record?.totalCommission || 0 };
  });
}

async function getPayrollCommissionItems(employee, month, year) {
  if (!mongoose.isObjectIdOrHexString(employee?._id) || !mongoose.isObjectIdOrHexString(employee?.companyId)) return [];
  const record = await SalesCommission.findOne({ companyId: employee.companyId, employeeId: employee._id, month, year }).lean();
  return (record?.items || []).filter(item => item.commissionAmount > 0).map(item => ({
    label: `${item.name} Commission`, name: item.name, amount: item.commissionAmount,
    quantity: item.quantity, salesAmount: item.salesAmount, rate: item.rate, unit: item.unit,
  }));
}

module.exports = { listPeriod, savePeriod, getMine, getPayrollCommissionItems, shapeItems };
