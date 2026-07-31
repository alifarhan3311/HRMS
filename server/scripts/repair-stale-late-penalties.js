require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase } = require('../src/database/db');
const Attendance = require('../src/modules/attendance/attendance.model');
const Employee = require('../src/modules/employees/employees.model');
const { isSaturdayShiftDate } = require('../src/modules/attendance/saturdayPolicy');

async function main() {
  await connectDatabase();

  const saturdayCandidates = await Attendance.find({
    $or: [
      { status: 'late' },
      { lateMinutes: { $gt: 0 } },
      { lateCountAppliedAt: { $exists: true } },
      { missedPunchType: { $in: ['sign_in', 'sign_out'] } },
    ],
  }).select('_id shiftDate signInTime').lean();
  const saturdayRecords = saturdayCandidates.filter((record) => isSaturdayShiftDate(record.shiftDate));
  const saturdayPresentIds = saturdayRecords.filter((record) => record.signInTime).map((record) => record._id);
  const saturdayAbsentIds = saturdayRecords.filter((record) => !record.signInTime).map((record) => record._id);
  if (saturdayPresentIds.length) {
    await Attendance.updateMany(
      { _id: { $in: saturdayPresentIds } },
      {
        $set: { status: 'present', lateMinutes: 0 },
        $unset: { missedPunchType: '', lateCountAppliedAt: '' },
      },
    );
  }
  if (saturdayAbsentIds.length) {
    await Attendance.updateMany(
      { _id: { $in: saturdayAbsentIds } },
      {
        $set: { status: 'absent', lateMinutes: 0 },
        $unset: { missedPunchType: '', lateCountAppliedAt: '' },
      },
    );
  }

  const staleFilter = {
    lateCountAppliedAt: { $exists: true },
    $or: [
      { missedPunchType: 'sign_out', signOutTime: { $exists: true } },
      { missedPunchType: 'sign_in', signInTime: { $exists: true } },
      { missedPunchType: { $nin: ['sign_in', 'sign_out'] } },
    ],
  };
  const staleCount = await Attendance.countDocuments(staleFilter);
  const cleanup = await Attendance.updateMany(staleFilter, {
    $unset: { missedPunchType: '', lateCountAppliedAt: '' },
  });

  const violationCounts = await Attendance.aggregate([
    {
      $match: {
        $or: [
          { status: 'late', lateMinutes: { $gt: 0 } },
          {
            lateCountAppliedAt: { $exists: true },
            missedPunchType: { $in: ['sign_in', 'sign_out'] },
          },
        ],
      },
    },
    { $group: { _id: '$employeeId', count: { $sum: 1 } } },
  ]);
  const countByEmployee = new Map(
    violationCounts.map((item) => [String(item._id), item.count]),
  );
  const employees = await Employee.find({ status: 'active' }).select('_id lateCount');
  let countersUpdated = 0;
  for (const employee of employees) {
    const lateCount = countByEmployee.get(String(employee._id)) || 0;
    if (Number(employee.lateCount || 0) === lateCount) continue;
    await Employee.updateOne({ _id: employee._id }, { $set: { lateCount } });
    countersUpdated += 1;
  }

  console.log(JSON.stringify({
    saturdayPenaltyRecordsCleaned: saturdayRecords.length,
    staleRecordsFound: staleCount,
    staleRecordsCleaned: cleanup.modifiedCount,
    employeeCountersUpdated: countersUpdated,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close(false));
