const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
dotenv.config();

const Employee = require('./src/modules/employees/employees.model');
const Attendance = require('./src/modules/attendance/attendance.model');
const Shift = require('./src/modules/shifts/shifts.model');

async function run() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' }); // Check dbName, might be default in URI
    console.log('Connected to DB');

    const targetDateStr = '2026-09-24';
    const targetDate = new Date(targetDateStr);

    // Get employees in call center
    const employees = await Employee.find({
      
      department: { $regex: /call center/i }
    }).populate('shiftId').lean();

    console.log(`Found ${employees.length} employees in Call Center.`);

    for (let emp of employees) {
      if (!emp.shiftId) {
        console.log(`Skipping ${emp.fullName}: No shift assigned.`);
        continue;
      }
      
      const shift = emp.shiftId;
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);

      const signIn = new Date(targetDate);
      signIn.setHours(startHour, startMin, 0, 0);

      const signOut = new Date(targetDate);
      signOut.setHours(endHour, endMin, 0, 0);
      
      // If end crosses midnight
      if (signOut <= signIn) {
        signOut.setDate(signOut.getDate() + 1);
      }

      let status = 'present';
      let actualSignIn = new Date(signIn);
      let actualSignOut = new Date(signOut);
      
      const name = emp.fullName.toLowerCase().trim();

      // Absentees
      if (name.includes('ali abbas') || name.includes('syed hassan ali jaffari')) {
        status = 'absent';
        actualSignIn = null;
        actualSignOut = null;
      }
      // Late comers
      else if (['eshan iqbal', 'ayan ali', 'abdullah', 'muhammad bilal khan', 'muhammad hassan khan'].some(n => name.includes(n))) {
        status = 'late';
        actualSignIn.setMinutes(actualSignIn.getMinutes() + (shift.graceMinutes || 15) + 30); // 30 mins after grace
      }
      
      let workedMinutes = 0;
      let totalHours = 0;
      
      if (actualSignIn && actualSignOut) {
        workedMinutes = Math.floor((actualSignOut - actualSignIn) / 60000);
        totalHours = parseFloat((workedMinutes / 60).toFixed(2));
      }

      const query = { employeeId: emp._id, shiftDate: targetDateStr };
      const update = {
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        date: targetDate,
        shiftId: shift._id,
        shiftName: shift.name,
        employeeDepartment: emp.department,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftGraceMinutes: shift.graceMinutes,
        shiftRequiredMinutes: shift.requiredWorkingMinutes,
        scheduledStart: signIn,
        scheduledEnd: signOut,
        signInTime: actualSignIn,
        signOutTime: actualSignOut,
        totalHours: totalHours,
        workedMinutes: workedMinutes,
        status: status,
        companyId: emp.companyId,
        branchId: emp.branchId
      };

      await Attendance.findOneAndUpdate(query, update, { upsert: true });
      console.log(`Updated attendance for ${emp.fullName}: ${status}`);
    }

    console.log('Attendance updated successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
