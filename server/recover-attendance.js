require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
const mongoose = require('mongoose');
const Employee = require('./src/modules/employees/employees.model');
const attService = require('./src/modules/attendance/attendance.service');
const attRepository = require('./src/modules/attendance/attendance.repository');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
  
  const depts = await Employee.distinct('department');
  console.log('All Departments:', depts);
  
  // Find employees in Accounts and Operations, excluding 'Zahid Hussain'
  const emps = await Employee.find({
    department: { $in: [/account/i, /operation/i] },
    fullName: { $ne: 'Zahid Hussain' },
    role: { $ne: 'super_admin' }, // usually we skip super_admin
    status: 'active'
  });
  
  console.log(`Found ${emps.length} employees to process.`);

  let successCount = 0;
  for (const emp of emps) {
    try {
      console.log(`Processing ${emp.fullName} (${emp.department})...`);
      const actor = { id: emp._id, role: emp.role, companyId: emp.companyId, branchId: emp.branchId };
      
      const shiftDate = '2026-09-24';
      
      // Check if attendance already exists
      const existing = await attRepository.findByEmployeeAndShiftDate(emp._id, shiftDate);
      if (existing) {
        console.log(` - Overwriting existing record to exact night shift hours...`);
        // Set exactly to 08:09 PM (24 Sept) and 04:10 AM (25 Sept)
        const sIn = new Date('2026-09-24T20:09:00.000+05:00');
        const sOut = new Date('2026-09-25T04:10:00.000+05:00');
        
        await attRepository.updateById(existing._id, {
          signInTime: sIn,
          signOutTime: sOut,
          status: 'present',
          totalHours: 8.01,
          workedMinutes: 481,
          lateMinutes: 0,
          overtimeMinutes: 0,
          earlyLeaveMinutes: 0,
          method: 'manual',
          notes: 'Manual recovery due to power outage (Night Shift)'
        });
        
        // Clear any late counts if applicable
        await Employee.updateOne({ _id: emp._id, lateCount: { $gt: 0 } }, { $inc: { lateCount: -1 } });
        
        console.log(` - Successfully corrected hours for ${shiftDate}.`);
        successCount++;
        continue;
      }
      
      console.log(` - No existing record found for ${shiftDate}.`);
    } catch (err) {
      console.log(` - Error for ${emp.fullName}:`, err.message);
    }
  }
  
  console.log(`\nCompleted. Successfully recovered ${successCount} employees.`);
  process.exit(0);
}

run();
