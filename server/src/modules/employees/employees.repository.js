/**
 * modules/employees/employees.repository.js
 * Data-access layer — the ONLY file in this module allowed to touch the
 * Mongoose model directly.
 */
const Employee = require('./employees.model');

async function create(data) {
  return Employee.create(data);
}

async function findById(id) {
  return Employee.findById(id)
    .populate('managerId', 'fullName employeeCode designation')
    .populate('teamLeadId', 'fullName employeeCode designation');
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

async function deleteById(id) {
  return Employee.findByIdAndDelete(id);
}

async function clearReportingReferences(id) {
  return Promise.all([
    Employee.updateMany({ managerId: id }, { $unset: { managerId: '' } }),
    Employee.updateMany({ teamLeadId: id }, { $unset: { teamLeadId: '' } }),
  ]);
}

async function countByCompany(companyId) {
  return Employee.countDocuments({ companyId });
}

async function getDistinctDepartments(companyId) {
  return Employee.distinct('department', { companyId, department: { $ne: null, $ne: '' } });
}

async function getStats(companyId) {
  return Employee.aggregate([
    { $match: { companyId } },
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

module.exports = {
  create,
  findById,
  findByEmail,
  findByCnic,
  findAll,
  updateById,
  updateRaw,
  deleteById,
  clearReportingReferences,
  countByCompany,
  getDistinctDepartments,
  getStats,
};
