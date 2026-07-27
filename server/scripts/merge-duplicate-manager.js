require('dotenv').config();
const mongoose = require('mongoose');

function normalizeDepartments(values = []) {
  return [...new Set(values
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const keepEmail = String(process.env.KEEP_MANAGER_EMAIL || '').trim().toLowerCase();
  const keepId = process.env.KEEP_MANAGER_ID;
  const duplicateId = process.env.DUPLICATE_MANAGER_ID;
  const apply = String(process.env.APPLY || '').toLowerCase() === 'true';
  const deleteDuplicate = String(process.env.DELETE_DUPLICATE || '').toLowerCase() === 'true';

  if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is required.');
  if (!keepEmail && !mongoose.isValidObjectId(keepId)) {
    throw new Error('Set KEEP_MANAGER_EMAIL or a valid KEEP_MANAGER_ID.');
  }
  if (duplicateId && !mongoose.isValidObjectId(duplicateId)) {
    throw new Error('DUPLICATE_MANAGER_ID must be a valid MongoDB ObjectId.');
  }

  await mongoose.connect(uri);
  const employees = mongoose.connection.collection('employees');
  const sessions = mongoose.connection.collection('sessions');
  const attendance = mongoose.connection.collection('attendances');
  const leaves = mongoose.connection.collection('leaverequests');
  const payroll = mongoose.connection.collection('payslips');

  const correct = await employees.findOne(keepEmail
    ? { email: keepEmail, role: 'manager' }
    : { _id: new mongoose.Types.ObjectId(keepId), role: 'manager' });
  if (!correct) throw new Error('The manager account to retain was not found.');

  let duplicate;
  if (duplicateId) {
    duplicate = await employees.findOne({ _id: new mongoose.Types.ObjectId(duplicateId) });
  } else {
    const sameNameManagers = await employees.find({
      companyId: correct.companyId,
      role: 'manager',
      _id: { $ne: correct._id },
      fullName: { $regex: `^${String(correct.fullName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).toArray();
    if (sameNameManagers.length !== 1) {
      throw new Error(
        `Expected exactly one duplicate manager named "${correct.fullName}", found ${sameNameManagers.length}. `
        + 'Set DUPLICATE_MANAGER_ID explicitly.',
      );
    }
    [duplicate] = sameNameManagers;
  }
  if (!duplicate) throw new Error('The duplicate manager record was not found.');
  if (String(correct._id) === String(duplicate._id)) {
    throw new Error('The correct and duplicate manager records must be different.');
  }
  if (correct.role !== 'manager' || duplicate.role !== 'manager') {
    throw new Error('Both selected records must have the manager role.');
  }
  if (String(correct.companyId) !== String(duplicate.companyId)) {
    throw new Error('Managers belong to different companies and cannot be merged.');
  }

  const duplicateObjectId = duplicate._id;
  const correctObjectId = correct._id;
  const managedDepartments = normalizeDepartments([
    correct.department,
    duplicate.department,
    ...(correct.managedDepartments || []),
    ...(duplicate.managedDepartments || []),
  ]);
  const [directReports, activeSessions, attendanceRecords, leaveRecords, payrollRecords] = await Promise.all([
    employees.countDocuments({ companyId: correct.companyId, managerId: duplicateObjectId }),
    sessions.countDocuments({ employeeId: duplicateObjectId }),
    attendance.countDocuments({ employeeId: duplicateObjectId }),
    leaves.countDocuments({ employeeId: duplicateObjectId }),
    payroll.countDocuments({ employeeId: duplicateObjectId }),
  ]);

  const impact = {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    correctManager: { id: String(correct._id), name: correct.fullName, email: correct.email },
    duplicateManager: { id: String(duplicate._id), name: duplicate.fullName, email: duplicate.email },
    managedDepartments,
    directReportsToReassign: directReports,
    duplicateSessionsToRevoke: activeSessions,
    historicalRecordsRetainedOnDuplicate: {
      attendance: attendanceRecords,
      leaves: leaveRecords,
      payroll: payrollRecords,
    },
  };

  if (!apply) {
    console.log(JSON.stringify(impact, null, 2));
    console.log('Dry run only. Review the IDs and rerun with APPLY=true to perform the merge.');
    return;
  }

  const reportResult = await employees.updateMany(
    { companyId: correct.companyId, managerId: duplicateObjectId },
    { $set: { managerId: correctObjectId } },
  );
  await employees.updateOne(
    { _id: correctObjectId },
    { $set: { managedDepartments, updatedAt: new Date() } },
  );
  await employees.updateOne(
    { _id: duplicateObjectId },
    {
      $set: {
        status: 'inactive',
        exitReason: `Duplicate manager merged into ${correct._id}`,
        exitDate: new Date(),
        updatedAt: new Date(),
      },
      $inc: { tokenVersion: 1 },
    },
  );
  const sessionResult = await sessions.deleteMany({ employeeId: duplicateObjectId });
  let deletion = null;
  if (deleteDuplicate) {
    const [attendanceResult, leaveResult, payrollResult] = await Promise.all([
      attendance.deleteMany({ employeeId: duplicateObjectId }),
      leaves.deleteMany({ employeeId: duplicateObjectId }),
      payroll.deleteMany({ employeeId: duplicateObjectId }),
    ]);
    const employeeResult = await employees.deleteOne({ _id: duplicateObjectId });
    deletion = {
      employeeDeleted: employeeResult.deletedCount,
      attendanceDeleted: attendanceResult.deletedCount,
      leavesDeleted: leaveResult.deletedCount,
      payrollDeleted: payrollResult.deletedCount,
    };
  }

  console.log(JSON.stringify({
    ...impact,
    directReportsReassigned: reportResult.modifiedCount,
    duplicateSessionsRevoked: sessionResult.deletedCount,
    duplicateAction: deleteDuplicate ? 'permanently_deleted' : 'deactivated',
    deletion,
  }, null, 2));
}

run()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
