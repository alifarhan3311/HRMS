require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, {strict:false}), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, {strict:false}), 'employees');
  const e = await Employee.findOne({ fullName: /Muhammad Hassan Khan/i });

  // Check Sept records using date field
  const r1 = await Attendance.find({
    employeeId: e._id,
    date: { $gte: new Date('2026-09-01'), $lte: new Date('2026-09-05T23:59:59') }
  }).sort('date');
  console.log('By date field - Sept 1-5 count:', r1.length);
  r1.forEach(rec => console.log('shiftDate:', rec.shiftDate, 'date:', rec.date, 'status:', rec.status));

  // Check Sept records using shiftDate field
  const shiftDates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
  const r2 = await Attendance.find({ employeeId: e._id, shiftDate: { $in: shiftDates } }).sort('shiftDate');
  console.log('\nBy shiftDate field - Sept 1-5 count:', r2.length);
  r2.forEach(rec => console.log('shiftDate:', rec.shiftDate, 'date:', rec.date, 'status:', rec.status));
  mongoose.disconnect();
}).catch(console.error);
