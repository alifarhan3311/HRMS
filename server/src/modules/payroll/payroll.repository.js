/**
 * modules/payroll/payroll.repository.js
 */
const Payslip = require('./payroll.model');
const PayrollArchive = require('./payrollArchive.model');
const mongoose = require('mongoose');
const createHttpError = require('http-errors');

async function create(data) { return Payslip.create(data); }

async function findById(id) {
  return Payslip.findById(id).populate(
    'employeeId',
    'fullName employeeCode department designation joiningDate salaryPaymentMethod salaryAccountNumber salaryAccountTitle'
  );
}

async function findByEmployeeAndPeriod(employeeId, month, year) {
  return Payslip.findOne({ employeeId, month, year });
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-year -month' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payslip.find(filter)
      .populate(
        'employeeId',
        'fullName employeeCode department designation profilePicture joiningDate salaryPaymentMethod salaryAccountNumber salaryAccountTitle'
      )
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

async function clearPeriodWithArchive({ companyId, month, year }, clearedBy) {
  // Fail closed on deployments without transaction support: never delete
  // records unless their recovery snapshots commit in the same transaction.
  return Payslip.db.transaction(async session => {
    const filter = { companyId, month, year };
    const records = await Payslip.find(filter).session(session).lean();
    if (!records.length) return { clearedCount: 0, archiveBatchId: null };
    const batchId = new mongoose.Types.ObjectId();
    const clearedAt = new Date();
    await PayrollArchive.insertMany(records.map(record => ({
      companyId, month, year, batchId, payslipId: record._id, clearedBy, clearedAt,
      snapshot: record,
    })), { session });
    const result = await Payslip.deleteMany({
      ...filter, _id: { $in: records.map(record => record._id) },
    }).session(session);
    if (result.deletedCount !== records.length) {
      throw createHttpError(409, 'Payroll changed while clearing. Nothing was cleared; please refresh and try again.');
    }
    return { clearedCount: records.length, archiveBatchId: String(batchId) };
  });
}

module.exports = { create, findById, findByEmployeeAndPeriod, findAll, updateById, getMonthlyStats, clearPeriodWithArchive };
