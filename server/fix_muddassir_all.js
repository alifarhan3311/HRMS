require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendances');
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
  const emp = await Employee.findOne({ fullName: /Muhammad Muddassir/i });
  if (!emp) { console.log('Not found'); return mongoose.disconnect(); }

  // ─── Helper: compute late minutes based on scheduledStart + grace ───
  function calcLateMin(signInTime, scheduledStart, graceMinutes) {
    if (!signInTime || !scheduledStart) return 0;
    const graceDeadline = new Date(scheduledStart).getTime() + (Number(graceMinutes) || 0) * 60000;
    const diff = new Date(signInTime).getTime() - graceDeadline;
    return diff > 0 ? Math.floor(diff / 60000) : 0;
  }

  // ─── Helper: compute status ───
  function computeStatus(lateMinutes, workedMinutes, reqMinutes, halfDayMinutes, lateHalfDayAfterMinutes) {
    const tolerance = reqMinutes >= 480 ? 150 : (reqMinutes > 360 ? 120 : 60);
    const isLateArrival = lateMinutes > 0;
    const isHalfDayArrival = lateHalfDayAfterMinutes > 0 && lateMinutes > lateHalfDayAfterMinutes;

    if (workedMinutes >= Math.max(0, reqMinutes - tolerance)) {
      return isHalfDayArrival ? 'half_day' : (isLateArrival ? 'late' : 'present');
    }
    if (workedMinutes >= halfDayMinutes) return 'half_day';
    return 'absent';
  }

  const recs = await Attendance.find({
    employeeId: emp._id,
    shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' },
    status: { $nin: ['holiday', 'weekend', 'on_leave', 'absent'] }
  });

  let fixed = 0;
  for (const r of recs) {
    if (!r.signInTime || !r.scheduledStart) continue;

    const reqMinutes = Number(r.effectiveRequiredMinutes || r.shiftRequiredMinutes || 480);
    const halfDayMinutes = Number(r.shiftHalfDayMinutes || Math.ceil(reqMinutes / 2));
    const lateHalfDayAfterMinutes = Number(r.shiftLateHalfDayAfterMinutes || 150);
    const graceMinutes = Number(r.shiftGraceMinutes || 0);
    const workedMinutes = Number(r.workedMinutes || 0);

    const correctLate = calcLateMin(r.signInTime, r.scheduledStart, graceMinutes);

    let correctStatus;
    if (!r.signOutTime) {
      // No sign-out - keep as-is (incomplete/present set by sign-in)
      continue;
    }
    correctStatus = computeStatus(correctLate, workedMinutes, reqMinutes, halfDayMinutes, lateHalfDayAfterMinutes);

    const dbLate = Number(r.lateMinutes || 0);
    const dbStatus = r.status;

    // Fix 24 Sept data error (DB shows 468 min late which is wrong)
    const needsFix = dbLate !== correctLate || dbStatus !== correctStatus;
    if (!needsFix) continue;

    console.log(`Fixing ${r.shiftDate}: late ${dbLate}→${correctLate} | status ${dbStatus}→${correctStatus} | worked:${workedMinutes}m`);
    await Attendance.updateOne(
      { _id: r._id },
      { $set: { lateMinutes: correctLate, status: correctStatus } }
    );
    fixed++;
  }

  console.log(`\nTotal fixed: ${fixed} records`);
  mongoose.disconnect();
}).catch(console.error);
