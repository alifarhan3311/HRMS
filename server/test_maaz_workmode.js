require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  try {
    const db = mongoose.connection.db;
    const employee = await db.collection('employees').findOne({ fullName: /Maaz Bin Anis/i });
    if (employee) {
      console.log('Found employee:', employee.fullName, 'workMode:', employee.workMode);
      const records = await db.collection('attendances').find({
        employeeId: employee._id,
        shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' }
      }).limit(5).toArray();
      records.forEach(r => console.log('Record status:', r.status, 'workMode:', r.workMode));
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
