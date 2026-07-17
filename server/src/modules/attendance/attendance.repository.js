/**
 * modules/attendance/attendance.repository.js
 * Data-access layer for Attendance — all DB calls isolated here.
 */
const Attendance = require('./attendance.model');

async function create(data) {
  return Attendance.create(data);
}

async function findById(id) {
  return Attendance.findById(id)
    .populate('employeeId', 'fullName employeeCode department designation managerId teamLeadId')
    .populate('regularization.assignedApprover', 'fullName employeeCode designation role')
    .populate('regularization.reviewedBy', 'fullName employeeCode designation role');
}

async function findByEmployeeAndDate(employeeId, date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return Attendance.findOne({ employeeId, date: { $gte: start, $lte: end } });
}

async function findAll({ filter = {}, page = 1, limit = 30, sort = '-date' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employeeId', 'fullName employeeCode department designation profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return Attendance.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function getMonthlySummary(employeeId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return Attendance.find({ employeeId, date: { $gte: start, $lte: end } }).sort('date');
}

async function getMonthlyAggregation(companyId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return Attendance.aggregate([
    { $match: { companyId, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
}

async function getLateCountForMonth(employeeId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return Attendance.countDocuments({
    employeeId,
    date: { $gte: start, $lte: end },
    lateMinutes: { $gt: 0 },
  });
}

async function getPendingRegularizations(companyId) {
  return Attendance.find({ companyId, regularizationStatus: 'pending' })
    .populate('employeeId', 'fullName employeeCode department')
    .populate('regularization.assignedApprover', 'fullName employeeCode designation role')
    .sort('-createdAt')
    .limit(50);
}

module.exports = {
  create,
  findById,
  findByEmployeeAndDate,
  findAll,
  updateById,
  getMonthlySummary,
  getMonthlyAggregation,
  getLateCountForMonth,
  getPendingRegularizations,
};
