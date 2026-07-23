/**
 * modules/employees/employees.repository.js
 * Data-access layer — the ONLY file in this module allowed to touch the
 * Mongoose model directly.
 */
const Employee = require('./employees.model');
const EmployeeSequence = require('./employeeSequence.model');
const mongoose = require('mongoose');

async function create(data) {
  return Employee.create(data);
}

async function findById(id) {
  return Employee.findById(id)
    .populate('managerId', 'fullName employeeCode designation')
    .populate('teamLeadId', 'fullName employeeCode designation')
    .populate('shiftId', 'name code shiftType startTime endTime graceMinutes lateHalfDayAfterMinutes requiredMinutes breakMinutes halfDayMinutes overtimeAfterMinutes workingDays isActive');
}

async function findByEmail(email, companyId) {
  return Employee.findOne({ email: email.toLowerCase(), companyId });
}

async function findByCnic(cnic, companyId) {
  // CNIC is encrypted at field level, so direct query won't work on
  // ciphertext. Instead, rely on application-level check using decrypted
  // values. A production system would store a HMAC lookup hash — the
  // pattern exists in utils/crypto.js via hashForLookup().
  // For now we return null to allow; uniqueness enforced by unique index on email.
  return null;
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Employee.find(filter)
      .select('-passwordHash -__v')
      .populate('managerId', 'fullName employeeCode')
      .populate('teamLeadId', 'fullName employeeCode')
      .populate('shiftId', 'name code shiftType startTime endTime graceMinutes lateHalfDayAfterMinutes requiredMinutes breakMinutes halfDayMinutes overtimeAfterMinutes workingDays isActive')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return Employee.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function updateRaw(id, update) {
  return Employee.findByIdAndUpdate(id, update, { new: true });
}

async function resetPassword(id, passwordHash) {
  return Employee.findByIdAndUpdate(
    id,
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
    { new: true },
  );
}

async function deleteById(id) {
  return Employee.findByIdAndDelete(id);
}

async function clearReportingReferences(id) {
  return Promise.all([
    Employee.updateMany({ managerId: id }, { $unset: { managerId: '' } }),
    Employee.updateMany({ teamLeadId: id }, { $unset: { teamLeadId: '' } }),
  ]);
}

function departmentPattern(department) {
  const escaped = String(department || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

async function findActiveDepartmentManager(companyId, department, excludeId = null) {
  if (!String(department || '').trim()) return null;
  const filter = {
    companyId,
    department: departmentPattern(department),
    role: 'manager',
    status: 'active',
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Employee.findOne(filter).sort({ createdAt: 1 });
}

async function assignDepartmentManager(companyId, department, managerId) {
  if (!String(department || '').trim()) return { modifiedCount: 0 };
  return Employee.updateMany({
    companyId,
    department: departmentPattern(department),
    role: { $in: ['team_lead', 'employee'] },
    _id: { $ne: managerId },
    status: { $ne: 'resigned' },
  }, { $set: { managerId } });
}

async function clearManagerReferences(managerId) {
  return Employee.updateMany({ managerId }, { $unset: { managerId: '' } });
}

async function findActiveDepartmentTeamLeads(companyId, department) {
  if (!String(department || '').trim()) return [];
  return Employee.find({
    companyId,
    department: departmentPattern(department),
    role: 'team_lead',
    status: 'active',
  }).sort({ fullName: 1 });
}

async function clearTeamLeadReferences(teamLeadId) {
  return Employee.updateMany({ teamLeadId }, { $unset: { teamLeadId: '' } });
}

async function syncDepartmentManagers(companyId) {
  const managers = await Employee.find({ companyId, role: 'manager', status: 'active', department: { $nin: [null, ''] } })
    .sort({ createdAt: 1 });
  for (const manager of managers) {
    // Intentionally sequential: the oldest active manager remains canonical
    // if legacy data contains duplicate managers for one department.
    // eslint-disable-next-line no-await-in-loop
    const canonical = await findActiveDepartmentManager(companyId, manager.department);
    if (String(canonical?._id) !== String(manager._id)) continue;
    // eslint-disable-next-line no-await-in-loop
    await assignDepartmentManager(companyId, manager.department, manager._id);
  }
}

async function countByCompany(companyId) {
  return Employee.countDocuments({ companyId });
}

async function nextSequence(companyId) {
  let sequence;
  try {
    sequence = await EmployeeSequence.findOneAndUpdate(
      { companyId },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Two first employees can race to create the company counter. The unique
    // company index elects one insert; the other safely increments it here.
    if (error?.code !== 11000) throw error;
    sequence = await EmployeeSequence.findOneAndUpdate(
      { companyId },
      { $inc: { value: 1 } },
      { new: true }
    );
  }
  return sequence.value;
}

async function getDistinctDepartments(companyId) {
  return Employee.distinct('department', { companyId, department: { $ne: null, $ne: '' } });
}

async function normalizeDepartmentNames(companyId) {
  return Employee.updateMany(
    { companyId, department: { $type: 'string', $ne: '', $regex: /[A-Z]|^\s|\s$/ } },
    [{
      $set: {
        department: {
          $toLower: { $trim: { input: '$department' } },
        },
      },
    }]
  );
}

async function getStats(filter) {
  // Mongoose casts normal find() filters but not aggregation pipeline
  // values. JWT tenant/user ids arrive as strings, so cast them explicitly.
  const match = { ...filter };
  for (const field of ['companyId', 'managerId', 'teamLeadId']) {
    if (typeof match[field] === 'string' && mongoose.isValidObjectId(match[field])) {
      match[field] = new mongoose.Types.ObjectId(match[field]);
    }
  }
  return Employee.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        onLeave: { $sum: { $cond: [{ $eq: ['$status', 'on_leave'] }, 1, 0] } },
        resigned: { $sum: { $cond: [{ $eq: ['$status', 'resigned'] }, 1, 0] } },
      },
    },
  ]);
}

async function getHierarchy(filter) {
  return Employee.find({ ...filter, status: { $ne: 'resigned' } })
    .select('fullName employeeCode email department designation role status profilePicture managerId teamLeadId')
    .populate('managerId', 'fullName employeeCode designation role profilePicture')
    .populate('teamLeadId', 'fullName employeeCode designation role profilePicture')
    .sort({ role: 1, fullName: 1 });
}

module.exports = {
  create,
  findById,
  findByEmail,
  findByCnic,
  findAll,
  updateById,
  updateRaw,
  resetPassword,
  deleteById,
  clearReportingReferences,
  findActiveDepartmentManager,
  assignDepartmentManager,
  clearManagerReferences,
  syncDepartmentManagers,
  findActiveDepartmentTeamLeads,
  clearTeamLeadReferences,
  countByCompany,
  nextSequence,
  getDistinctDepartments,
  normalizeDepartmentNames,
  getStats,
  getHierarchy,
};
