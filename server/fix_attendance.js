const mongoose = require('mongoose');
const Attendance = require('./src/modules/attendance/attendance.model');
const Shift = require('./src/modules/shifts/shifts.model');
require('dotenv').config();

async function fixAttendance() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log('Connected to DB');

    const shift = await Shift.findOne({ code: 'NIGHT_6_FIXED' });
    if (!shift) {
      console.log('Shift not found');
      process.exit(1);
    }

    const records = await Attendance.find({ shiftId: shift._id, status: 'late' });
    console.log('Found', records.length, 'late records for this shift.');

    let fixedCount = 0;
    for (let record of records) {
      if (record.signInTime && record.shiftStartTime) {
        const [startHour, startMinute] = record.shiftStartTime.split(':').map(Number);
        
        const signIn = new Date(record.signInTime);
        signIn.setUTCHours(signIn.getUTCHours() + 5);
        const signInTotalMinutes = signIn.getUTCHours() * 60 + signIn.getUTCMinutes();
        const startTotalMinutes = startHour * 60 + startMinute;
        
        let lateMins = signInTotalMinutes - startTotalMinutes;
        if (lateMins < 0 && lateMins > -100) lateMins = 0; // if they arrived early
        
        if (lateMins <= shift.graceMinutes) {
           console.log('Fixing record on', record.shiftDate, 'SignIn:', record.signInTime);
           record.lateMinutes = 0;
           record.status = 'present';
           record.shiftGraceMinutes = shift.graceMinutes;
           await record.save();
           fixedCount++;
        }
      }
    }

    console.log('Fixed', fixedCount, 'records.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixAttendance();
