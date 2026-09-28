require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

mongoose.connect(process.env.MONGO_URI, { dbName: 'test' }).then(async () => {
  const Attendance = require('./src/modules/attendance/attendance.model');
  const att = await Attendance.findOne({ employeeName: /muhammad ashal taufique/i, shiftDate: '2026-09-23' });
  if (att) {
    // We update it to 'late' since 344 mins is within 60 mins tolerance
    att.status = 'late';
    await att.save();
    console.log('Updated to late!');
  }
  mongoose.disconnect();
});
