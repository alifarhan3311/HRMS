const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const { BiometricPunch, BiometricSyncState } = require('../src/integrations/zkteco/biometricPunch.model');
  const Attendance = require('../src/modules/attendance/attendance.model');
  const Employee = require('../src/modules/employees/employees.model');

  const syncState = await BiometricSyncState.find().lean();
  console.log('Sync State:', JSON.stringify(syncState, null, 2));

  const totalPunches = await BiometricPunch.countDocuments();
  console.log('Total BiometricPunch in DB:', totalPunches);

  const last10Punches = await BiometricPunch.find().sort({ _id: -1 }).limit(10).lean();
  console.log('Last 10 punches in DB:');
  for (const p of last10Punches) {
    console.log(`ID: ${p.deviceUserId}, machineTime: ${p.machineTimestamp?.toISOString()}, punchTime: ${p.punchTime?.toISOString()}, status: ${p.processingStatus}, attendanceAction: ${p.attendanceAction}, error: ${p.processingError || 'none'}`);
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayAttendance = await Attendance.find({ date: { $gte: todayStart } }).populate('employeeId', 'fullName biometricDeviceUserId').lean();
  console.log(`Today Attendance Records (${todayAttendance.length}):`);
  for (const a of todayAttendance) {
    console.log(`Emp: ${a.employeeId?.fullName} (${a.employeeId?.biometricDeviceUserId}), In: ${a.signInTime}, Out: ${a.signOutTime}, Status: ${a.status}`);
  }

  await mongoose.disconnect();
}
check().catch(console.error);
