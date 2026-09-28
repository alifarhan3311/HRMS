require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

mongoose.connect(process.env.MONGO_URI, { dbName: 'test' }).then(async () => {
  const Attendance = require('./src/modules/attendance/attendance.model');
  const Employee = require('./src/modules/employees/employees.model');
  
  const aniq = await Employee.findOne({ fullName: /Aniq/i });
  if (aniq) {
    const shiftDate = '2026-09-23';
    await Attendance.updateOne(
      { employeeId: aniq._id, shiftDate: shiftDate },
      {
        $set: {
          employeeName: aniq.fullName,
          employeeCode: aniq.employeeCode,
          date: new Date('2026-09-23T00:00:00Z'),
          shiftDate: shiftDate,
          employeeDepartment: aniq.department,
          status: 'absent',
          companyId: aniq.companyId,
          branchId: aniq.branchId,
          notes: 'System generated absent record for missing punch'
        }
      },
      { upsert: true }
    );
    
    // Check 20th as well
    await Attendance.updateOne(
      { employeeId: aniq._id, shiftDate: '2026-09-20' },
      {
        $set: {
          employeeName: aniq.fullName,
          employeeCode: aniq.employeeCode,
          date: new Date('2026-09-20T00:00:00Z'),
          shiftDate: '2026-09-20',
          employeeDepartment: aniq.department,
          status: 'weekend',
          companyId: aniq.companyId,
          branchId: aniq.branchId,
          notes: 'Weekend'
        }
      },
      { upsert: true }
    );
    console.log('Inserted missing dates for Aniq!');
  } else {
    console.log('Aniq not found');
  }
  mongoose.disconnect();
});
