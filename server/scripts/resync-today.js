const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

async function fixAndSync() {
  await mongoose.connect(process.env.MONGO_URI);
  const { BiometricSyncState, BiometricPunch } = require('../src/integrations/zkteco/biometricPunch.model');
  const zktecoService = require('../src/integrations/zkteco/zkteco.service');

  console.log('Resetting initializedAt and lastLogTime for 192.168.20.4:4370 to 2026-09-01...');
  
  // Set initializedAt to 2026-09-01 so it reconciles everything from September
  await BiometricSyncState.updateOne(
    { deviceId: '192.168.20.4:4370' },
    {
      $set: {
        initializedAt: new Date('2026-09-01T00:00:00.000Z'),
        lastLogTime: new Date('2026-09-01T00:00:00.000Z'),
      }
    }
  );

  console.log('Starting Biometric Service to trigger sync...');
  const stop = await zktecoService.startBiometricService();
  await new Promise(r => setTimeout(r, 6000));

  // Now check Maaz punches and attendance
  const Employee = require('../src/modules/employees/employees.model');
  const Attendance = require('../src/modules/attendance/attendance.model');
  const maaz = await Employee.findOne({ biometricDeviceUserId: '23' }).lean();

  const maazPunches = await BiometricPunch.find({
    deviceUserId: '23',
    createdAt: { $gte: new Date(Date.now() - 60000) }
  }).lean();
  console.log('Newly processed punches for Maaz:', maazPunches);

  const todayAttendance = await Attendance.find({
    employeeId: maaz._id,
    date: { $gte: new Date('2026-09-02T19:00:00.000Z') }
  }).lean();
  console.log('Maaz Today Attendance:', JSON.stringify(todayAttendance, null, 2));

  await stop();
  await mongoose.disconnect();
}

fixAndSync().catch(console.error);
