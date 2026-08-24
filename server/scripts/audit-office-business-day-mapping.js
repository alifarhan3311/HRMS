require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { connectDatabase, disconnectDatabase } = require('../src/database/db');
const Attendance = require('../src/modules/attendance/attendance.model');
require('../src/modules/employees/employees.model');

function businessDate(value, timeZone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  if (Number(parts.hour) < 18) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

(async () => {
  await connectDatabase();
  const records = await Attendance.find({
    method: 'biometric', signInTime: { $exists: true }, workMode: { $ne: 'wfh' },
  }).populate('employeeId', 'fullName employeeCode workMode biometricDeviceUserId').lean();
  const candidates = records.filter((record) => businessDate(record.signInTime, record.shiftTimezone || 'Asia/Karachi') !== record.shiftDate)
    .map((record) => ({
      attendanceId: String(record._id), employeeId: String(record.employeeId?._id || record.employeeId),
      employee: record.employeeId?.fullName || record.employeeName, shiftDate: record.shiftDate,
      expectedBusinessDate: businessDate(record.signInTime, record.shiftTimezone || 'Asia/Karachi'),
      signInTime: record.signInTime, signOutTime: record.signOutTime, workedMinutes: record.workedMinutes,
    }));
  console.log(JSON.stringify({ scanned: records.length, candidates }, null, 2));
  await disconnectDatabase();
})().catch(async (error) => { console.error(error.stack || error.message); await disconnectDatabase().catch(() => {}); process.exitCode = 1; });
