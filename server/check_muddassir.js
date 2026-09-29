require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
  const emp = await Employee.findOne({ fullName: /Muhammad Muddassir/i });
  console.log('Employee:', emp ? emp._id + ' - ' + emp.fullName : 'NOT FOUND');
  if (!emp) return mongoose.disconnect();
  const recs = await Attendance.find({
    employeeId: emp._id,
    shiftDate: { $in: ['2026-09-25', '2026-09-21'] }
  });
  for (const r of recs) {
    console.log('---');
    console.log('shiftDate:', r.shiftDate);
    console.log('status:', r.status);
    console.log('signInTime:', r.signInTime);
    console.log('signOutTime:', r.signOutTime);
    console.log('totalHours:', r.totalHours);
    console.log('workedMinutes:', r.workedMinutes);
    console.log('lateMinutes:', r.lateMinutes);
    console.log('earlyLeaveMinutes:', r.earlyLeaveMinutes);
    console.log('shiftRequiredMinutes:', r.shiftRequiredMinutes);
    console.log('shiftHalfDayMinutes:', r.shiftHalfDayMinutes);
    console.log('effectiveRequiredMinutes:', r.effectiveRequiredMinutes);
    console.log('scheduledStart:', r.scheduledStart);
    console.log('scheduledEnd:', r.scheduledEnd);
  }
  mongoose.disconnect();
}).catch(console.error);
