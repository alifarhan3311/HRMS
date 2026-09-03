const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

async function checkMaaz() {
  await mongoose.connect(process.env.MONGO_URI);
  const Employee = require('../src/modules/employees/employees.model');
  const Attendance = require('../src/modules/attendance/attendance.model');
  const { BiometricPunch } = require('../src/integrations/zkteco/biometricPunch.model');
  const ZKLib = require('node-zklib');

  // 1. Find employee Maaz
  const maazList = await Employee.find({
    fullName: { $regex: 'maaz', $options: 'i' }
  }).lean();

  console.log('=== Employee(s) named Maaz ===');
  console.log(JSON.stringify(maazList.map(e => ({
    _id: e._id,
    fullName: e.fullName,
    employeeCode: e.employeeCode,
    biometricDeviceUserId: e.biometricDeviceUserId,
    department: e.department,
    shiftId: e.shiftId,
    status: e.status
  })), null, 2));

  if (!maazList.length) {
    console.log('No employee found with name Maaz');
    await mongoose.disconnect();
    return;
  }

  const maaz = maazList[0];
  const deviceUserId = maaz.biometricDeviceUserId;

  // 2. Check Attendance for Maaz on 3 Sep
  const sep3Start = new Date('2026-09-02T19:00:00.000Z'); // 3 Sep midnight PKT (00:00 PKT is 2 Sep 19:00 UTC)
  const sep3End = new Date('2026-09-03T19:00:00.000Z');

  const attendanceRecords = await Attendance.find({
    employeeId: maaz._id,
    date: { $gte: sep3Start, $lte: sep3End }
  }).lean();

  console.log('\n=== Attendance Records on 3 Sep for Maaz ===');
  console.log(JSON.stringify(attendanceRecords, null, 2));

  // Also check all recent attendance for Maaz
  const allRecent = await Attendance.find({
    employeeId: maaz._id
  }).sort({ date: -1 }).limit(5).lean();
  console.log('\n=== Recent 5 Attendance Records for Maaz ===');
  for (const a of allRecent) {
    console.log(`Date: ${a.date?.toISOString()}, ShiftDate: ${a.shiftDate}, In: ${a.signInTime}, Out: ${a.signOutTime}, Status: ${a.status}`);
  }

  // 3. Check BiometricPunch for Maaz's deviceUserId
  console.log(`\n=== BiometricPunch for deviceUserId: "${deviceUserId}" ===`);
  const punches = await BiometricPunch.find({
    deviceUserId: String(deviceUserId)
  }).sort({ punchTime: -1 }).limit(10).lean();

  for (const p of punches) {
    console.log(`PunchTime: ${p.punchTime?.toISOString()} (Machine: ${p.machineTimestamp?.toISOString()}), Status: ${p.processingStatus}, Action: ${p.attendanceAction}, Error: ${p.processingError || 'none'}`);
  }

  // 4. Connect to machine and read all logs for this deviceUserId directly from machine!
  console.log('\n=== Querying Machine Directly for user logs ===');
  try {
    const zk = new ZKLib(process.env.ZKTECO_IP || '192.168.20.4', 4370, 5000, 4001, 0);
    await zk.createSocket();
    const logs = await zk.getAttendances();
    await zk.disconnect();

    const userLogs = (logs?.data || []).filter(l => String(l.deviceUserId || l.userId || l.userSn) === String(deviceUserId));
    console.log(`Found ${userLogs.length} total logs on machine for user ${deviceUserId}. Last 5:`);
    console.log(JSON.stringify(userLogs.slice(-5), null, 2));
  } catch (err) {
    console.error('Failed to query machine directly:', err.message);
  }

  await mongoose.disconnect();
}

checkMaaz().catch(console.error);
