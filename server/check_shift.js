require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const db = mongoose.connection.db;
  const emp = await db.collection('employees').findOne({ fullName: /Muhammad Hassan Khan/i });
  const rec = await db.collection('attendances').findOne({ employeeId: emp._id, shiftDate: '2026-09-02' });
  
  const shift = {
    shiftType: rec.shiftType || 'fixed',
    startTime: rec.shiftStartTime,
    endTime: rec.shiftEndTime,
    requiredMinutes: rec.shiftRequiredMinutes || 480,
    halfDayMinutes: rec.shiftHalfDayMinutes,
    overtimeAfterMinutes: rec.shiftOvertimeAfterMinutes,
  };
  const schedule = {
    shiftDate: rec.shiftDate,
    scheduledStart: rec.scheduledStart,
    scheduledEnd: rec.scheduledEnd,
    timeZone: rec.shiftTimezone || 'Asia/Karachi',
  };
  
  // We need to import the service to calculate effective policy, or we can just see what schedule has
  console.log('schedule', schedule);
  process.exit(0);
});
