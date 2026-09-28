require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

mongoose.connect(process.env.MONGO_URI, { dbName: 'test' }).then(async () => {
  const Attendance = require('./src/modules/attendance/attendance.model');
  const att1 = await Attendance.findOne({ employeeName: /muhammad ashal taufique/i, shiftDate: '2026-09-23' }).lean();
  const att2 = await Attendance.findOne({ employeeName: /muhammad ashal taufique/i, shiftDate: '2026-09-16' }).lean();
  console.log('23 Sep:', { hours: att1?.totalHours, status: att1?.status, required: att1?.shiftRequiredMinutes, method: att1?.method });
  console.log('16 Sep:', { hours: att2?.totalHours, status: att2?.status, required: att2?.shiftRequiredMinutes, method: att2?.method });
  mongoose.disconnect();
});
