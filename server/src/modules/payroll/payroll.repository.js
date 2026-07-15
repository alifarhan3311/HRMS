/**
 * modules/payroll/payroll.repository.js
 */
const Payslip = require('./payroll.model');

async function create(data) { return Payslip.create(data); }

async function findById(id) {
  return Payslip.findById(id).populate('employeeId', 'fullName employeeCode department designation');
}

async function findByEmployeeAndPeriod(employeeId, month, year) {
  return Payslip.findOne({ employeeId, month, year });
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-year -month' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payslip.find(filter)
      .populate('employeeId', 'fullName employeeCode department designation profilePicture')
      .sort(sort).skip(skip).limit(limit),
    Payslip.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return Payslip.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('employeeId', 'fullName employeeCode department');
}

async function getMonthlyStats(companyId, month, year) {
  return Payslip.aggregate([
    { $match: { companyId, month, year } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
}

module.exports = { create, findById, findByEmployeeAndPeriod, findAll, updateById, getMonthlyStats };
