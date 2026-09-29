require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
  const emp = await Employee.findOne({ fullName: /Muhammad Muddassir/i });
  if (!emp) { console.log('Not found'); return mongoose.disconnect(); }
  console.log('Employee:', emp.fullName);
  
  // Get Sept records
  const recs = await Attendance.find({
    employeeId: emp._id,
    shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' }
  }).sort({ shiftDate: 1 });
  
  console.log('\n=== ALL SEPT RECORDS ===');
  for (const r of recs) {
    const signIn = r.signInTime ? new Date(r.signInTime).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : 'NO';
    const signOut = r.signOutTime ? new Date(r.signOutTime).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : 'NO';
    const schedStart = r.scheduledStart ? new Date(r.scheduledStart).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '?';
    const schedEnd = r.scheduledEnd ? new Date(r.scheduledEnd).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) : '?';
    
    // Calculate what late should be
    let shouldBeLate = 0;
    if (r.scheduledStart && r.signInTime) {
      const grace = Number(r.shiftGraceMinutes || 0);
      const graceDeadline = new Date(r.scheduledStart).getTime() + grace * 60000;
      const signInMs = new Date(r.signInTime).getTime();
      shouldBeLate = signInMs > graceDeadline ? Math.floor((signInMs - graceDeadline) / 60000) : 0;
    }
    
    console.log(`${r.shiftDate} | IN:${signIn} OUT:${signOut} | Sched:${schedStart}-${schedEnd} | Grace:${r.shiftGraceMinutes}m | Worked:${r.workedMinutes}m | DB Late:${r.lateMinutes}m | CalcLate:${shouldBeLate}m | Status:${r.status}`);
  }

  mongoose.disconnect();
}).catch(console.error);
