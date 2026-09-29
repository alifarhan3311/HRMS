require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
  const emp = await Employee.findOne({ fullName: /Muhammad Muddassir/i });
  if (!emp) { console.log('Employee not found'); return mongoose.disconnect(); }

  // Fix 25 Sept - worked 354 min, required 480 - tolerance 150 = 330. 354 >= 330 = PRESENT
  const res25 = await Attendance.updateOne(
    { employeeId: emp._id, shiftDate: '2026-09-25' },
    { $set: { status: 'present' } }
  );
  console.log('25 Sept fix:', res25.modifiedCount, 'record(s) updated → status: present');

  // Verify
  const r = await Attendance.findOne({ employeeId: emp._id, shiftDate: '2026-09-25' });
  console.log('25 Sept status now:', r.status, '| workedMinutes:', r.workedMinutes, '| totalHours:', r.totalHours);

  mongoose.disconnect();
}).catch(console.error);
