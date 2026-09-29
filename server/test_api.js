require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const attendanceService = require('./src/modules/attendance/attendance.service.js');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  try {
    const db = mongoose.connection.db;
    const employee = await db.collection('employees').findOne({ fullName: /Muhammad Hassan/i });
    if (employee) {
      console.log('Employee:', employee.fullName);
      
      const actor = { companyId: employee.companyId, role: 'hr', id: 'fake_hr_id' };
      const query = {
        employeeId: employee._id.toString(),
        limit: 100,
        page: 1,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        sort: '-date' // as per service default
      };
      
      const result = await attendanceService.listAttendances(query, actor);
      console.log('Total records from API:', result.items.length);
      console.log('First record date/shiftDate:', result.items[0]?.date, result.items[0]?.shiftDate);
      console.log('Last record date/shiftDate:', result.items[result.items.length - 1]?.date, result.items[result.items.length - 1]?.shiftDate);
      
      const sep1Record = result.items.find(r => r.shiftDate === '2026-09-01');
      console.log('Has Sep 1 record?', sep1Record ? 'YES' : 'NO');
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
