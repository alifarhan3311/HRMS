/**
 * modules/leaves/leaves.repository.js
 */
const LeaveRequest = require('./leaves.model');

async function create(data) {
  return LeaveRequest.create(data);
}

async function findById(id) {
  return LeaveRequest.findById(id)
    .populate('employeeId', 'fullName employeeCode department designation profilePicture leaveBalance')
    .populate('approvalChain.approvedBy', 'fullName');
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate('employeeId', 'fullName employeeCode department designation profilePicture')
      .sort(sort).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return LeaveRequest.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('employeeId', 'fullName employeeCode department');
}

async function countActiveLeaves(employeeId, startDate, endDate) {
  return LeaveRequest.countDocuments({
    employeeId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
    ],
  });
}

async function getPendingByStage(companyId, stage, employeeIds = null) {
  return LeaveRequest.find({
    companyId,
    status: 'pending',
    currentStage: stage,
    ...(employeeIds && { employeeId: { $in: employeeIds } }),
  })
    .populate('employeeId', 'fullName employeeCode department designation profilePicture')
    .sort('-createdAt').limit(50);
}

module.exports = { create, findById, findAll, updateById, countActiveLeaves, getPendingByStage };
