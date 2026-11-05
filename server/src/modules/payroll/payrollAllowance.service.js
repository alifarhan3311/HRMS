const createHttpError = require('http-errors');
const Joi = require('joi');
const Employee = require('../employees/employees.model');
const Payslip = require('./payroll.model');
const Allowance = require('./payrollAllowance.model');
const { buildPayrollPeriod } = require('./prorationPolicy');

const SOURCE = 'hr_monthly';
const isCallCenter = department => ['callcenter', 'callcentre'].includes(String(department || '').toLowerCase().replace(/[^a-z]/g, ''));
const schema = Joi.object({
  employeeId: Joi.string().hex().length(24).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  amount: Joi.number().min(0).max(100000000).precision(2).required(),
}).unknown(false);

function withMonthlyAllowance(items, amount) {
  const result = (items || []).filter(item => item.source !== SOURCE).map(item => ({ label: item.label, amount: Number(item.amount || 0) }));
  if (amount > 0) result.push({ label: 'Allowance (HR)', amount, source: SOURCE });
  return result;
}

async function getAmount(employee, month, year) {
  if (!isCallCenter(employee?.department)) return 0;
  const record = await Allowance.findOne({ companyId: employee.companyId, employeeId: employee._id, month, year }).lean();
  return Number(record?.amount || 0);
}

async function getState(employee, month, year) {
  if (!isCallCenter(employee?.department)) return { allowanceAmount: 0, allowanceLocked: false };
  const [amount, payslip] = await Promise.all([
    getAmount(employee, month, year),
    Payslip.findOne({ companyId: employee.companyId, employeeId: employee._id, month, year }).select('status').lean(),
  ]);
  return { allowanceAmount: amount, allowanceLocked: !!payslip && payslip.status !== 'draft', allowancePayrollStatus: payslip?.status || null };
}

async function save(payload, actor) {
  if (!actor?.id || !actor.companyId || actor.role !== 'hr') throw createHttpError(403, 'Only HR can manage monthly allowances.');
  const { error, value } = schema.validate(payload, { convert: false });
  if (error) throw createHttpError(400, 'Enter a valid employee, payroll month/year and non-negative allowance (up to two decimals).');
  const { employeeId, month, year, amount } = value;
  const employee = await Employee.findOne({ _id: employeeId, companyId: actor.companyId }).select('department joiningDate');
  if (!employee) throw createHttpError(404, 'Employee not found.');
  if (!isCallCenter(employee.department)) throw createHttpError(400, 'Monthly allowances are available only for Call Center employees.');
  if (!buildPayrollPeriod({ joiningDate: employee.joiningDate, monthlySalary: 0, month, year }).employedDuringPeriod) {
    throw createHttpError(400, 'Employee had not joined during this payroll month.');
  }
  const filter = { companyId: actor.companyId, employeeId, month, year };
  // Production disables automatic model index builds. Ensure this new store's
  // unique monthly key exists before its first transactional upsert.
  await Allowance.collection.createIndex({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });
  // Saving the allowance and refreshing any draft payslip commit together.
  // Approved/paid snapshots are never silently changed.
  return Payslip.db.transaction(async session => {
    const payslip = await Payslip.findOne(filter).session(session);
    if (payslip && payslip.status !== 'draft') {
      throw createHttpError(409, 'This employee’s payroll is already submitted/approved/paid. Clear that payroll before changing the allowance.');
    }
    await Allowance.findOneAndUpdate(filter, { $set: { amount, updatedBy: actor.id } }, {
      session, upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
    });
    if (payslip) {
      const previousTotal = Number(payslip.allowances || 0);
      payslip.allowanceItems = withMonthlyAllowance(payslip.allowanceItems, amount);
      payslip.allowances = payslip.allowanceItems.reduce((sum, item) => sum + item.amount, 0);
      const previousGross = Number(payslip.grossSalary ?? (Number(payslip.periodBasicSalary ?? payslip.basicSalary ?? 0)
        + previousTotal + Number(payslip.commissionTotal || 0) + Number(payslip.bonus || 0) + Number(payslip.incentives || 0)));
      const gross = previousGross - previousTotal + payslip.allowances;
      payslip.grossSalary = String(gross);
      payslip.netSalary = String(Math.max(0, gross - Number(payslip.deductions || 0) - Number(payslip.taxDeduction || 0)));
      await payslip.save({ session });
    }
    return { employeeId, month, year, amount };
  });
}

module.exports = { getAmount, getState, save, withMonthlyAllowance };
