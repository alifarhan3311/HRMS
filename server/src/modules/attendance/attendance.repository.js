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
    .populate('employeeId', 'fullName employeeCode department designation managerId floorHeadId teamLeadId')
    .populate('regularization.assignedApprover', 'fullName employeeCode designation role')
    .populate('regularization.reportingReviewedBy', 'fullName employeeCode designation role')
    .populate('regularization.reviewedBy', 'fullName employeeCode designation role');
}

async function findByEmployeeAndDate(employeeId, date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return Attendance.findOne({ employeeId, date: { $gte: start, $lte: end } });
}

async function findByEmployeeAndShiftDate(employeeId, shiftDate) {
  return Attendance.findOne({ employeeId, shiftDate });
}

async function findOpenByEmployee(employeeId) {
  return Attendance.findOne({
    employeeId,
    signInTime: { $exists: true },
    signOutTime: { $exists: false },
    autoClosedAt: { $exists: false },
  })
    .sort({ signInTime: -1 });
}

async function findCheckoutCandidate(employeeId, punchTime, recoveryWindowMinutes = 240) {
  const punch = new Date(punchTime);
  const earliestEnd = new Date(punch.getTime() - (recoveryWindowMinutes * 60000));
  return Attendance.findOne({
    employeeId,
    signInTime: { $exists: true, $lt: punch },
    signOutTime: { $exists: false },
    scheduledStart: { $lte: punch },
    scheduledEnd: { $gte: earliestEnd },
  }).sort({ signInTime: -1 });
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

async function upsertByEmployeeShiftDate(employeeId, shiftDate, update) {
  return Attendance.findOneAndUpdate(
    { employeeId, shiftDate },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function findByClosure(closureId) {
  return Attendance.find({ closureId });
}

async function deleteById(id) {
  return Attendance.findByIdAndDelete(id);
}

async function getMonthlySummary(employeeId, year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return Attendance.find({ employeeId, date: { $gte: start, $lte: end } }).sort('date');
}

async function getRangeSummary(employeeId, dateFrom, dateTo, extraFilter = {}) {
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return Attendance.find({ employeeId, date: { $gte: start, $lte: end }, ...extraFilter })
    .sort('date')
    .lean();
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
    status: 'late',
  });
}

async function getPendingRegularizations(filter) {
  return Attendance.find({ ...filter, regularizationStatus: 'pending' })
    .populate('employeeId', 'fullName employeeCode department')
    .populate('regularization.assignedApprover', 'fullName employeeCode designation role')
    .populate('regularization.reportingReviewedBy', 'fullName employeeCode designation role')
    .sort('-createdAt')
    .limit(50);
}

async function getRegularizationApprovals(filter, limit = 200) {
  return Attendance.find(filter)
    .populate('employeeId', 'fullName employeeCode department designation')
    .populate('regularization.assignedApprover', 'fullName employeeCode designation role')
    .populate('regularization.reportingReviewedBy', 'fullName employeeCode designation role')
    .populate('regularization.reviewedBy', 'fullName employeeCode designation role')
    .sort({ 'regularization.requestedAt': -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  create,
  findById,
  findByEmployeeAndDate,
  findByEmployeeAndShiftDate,
  findOpenByEmployee,
  findCheckoutCandidate,
  findAll,
  updateById,
  upsertByEmployeeShiftDate,
  findByClosure,
  deleteById,
  getMonthlySummary,
  getRangeSummary,
  getMonthlyAggregation,
  getLateCountForMonth,
  getPendingRegularizations,
  getRegularizationApprovals,
};
