require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0';

mongoose.connect(mongoUri).then(async () => {
  try {
    const db = mongoose.connection.db;
    const employee = await db.collection('employees').findOne({ fullName: /Muhammad Muddassir/i });
    
    if (employee) {
      const record = await db.collection('attendances').findOne({
        employeeId: employee._id,
        shiftDate: '2026-09-26'
      });
      console.log('--- 26 Sept 2026 Record ---');
      console.log(JSON.stringify(record, null, 2));
      
      const leave = await db.collection('leaves').findOne({
        employeeId: employee._id,
        startDate: { $lte: '2026-09-26' },
        endDate: { $gte: '2026-09-26' }
      });
      if (leave) {
        console.log('--- Associated Leave ---');
        console.log(JSON.stringify(leave, null, 2));
      } else {
        console.log('--- No Leave Found ---');
      }
    } else {
      console.log('Employee not found');
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
