require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
  const emp = await Employee.findOne({ fullName: /Muhammad Muddassir/i });
  if (!emp) { console.log('Not found'); return mongoose.disconnect(); }

  const TOLERANCE = 30; // New tolerance

  function computeStatus(lateMinutes, workedMinutes, reqMinutes, halfDayMinutes, lateHalfDayAfterMinutes) {
    const isLateArrival = lateMinutes > 0;
    const isHalfDayArrival = lateHalfDayAfterMinutes > 0 && lateMinutes > lateHalfDayAfterMinutes;
    if (workedMinutes >= Math.max(0, reqMinutes - TOLERANCE)) {
      return isHalfDayArrival ? 'half_day' : (isLateArrival ? 'late' : 'present');
    }
    if (workedMinutes >= halfDayMinutes) return 'half_day';
    return 'absent';
  }

  const recs = await Attendance.find({
    employeeId: emp._id,
    shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' },
    signInTime: { $exists: true },
    signOutTime: { $exists: true }
  });

  let fixed = 0;
  for (const r of recs) {
    const reqMinutes = Number(r.effectiveRequiredMinutes || r.shiftRequiredMinutes || 480);
    const halfDayMinutes = Number(r.shiftHalfDayMinutes || Math.ceil(reqMinutes / 2));
    const lateHalfDayAfterMinutes = Number(r.shiftLateHalfDayAfterMinutes || 150);
    const workedMinutes = Number(r.workedMinutes || 0);
    const lateMinutes = Number(r.lateMinutes || 0);

    const correctStatus = computeStatus(lateMinutes, workedMinutes, reqMinutes, halfDayMinutes, lateHalfDayAfterMinutes);
    
    if (r.status === correctStatus) continue;
    
    console.log(`Fixing ${r.shiftDate}: ${r.status} → ${correctStatus} | worked:${workedMinutes}m | late:${lateMinutes}m | req:${reqMinutes}m`);
    await Attendance.updateOne({ _id: r._id }, { $set: { status: correctStatus } });
    fixed++;
  }
  console.log(`\nTotal fixed: ${fixed} records`);
  mongoose.disconnect();
}).catch(console.error);
