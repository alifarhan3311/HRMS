require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  try {
    const db = mongoose.connection.db;
    const employees = await db.collection('employees').find({}).toArray();
    for (const emp of employees) {
      const sepCount = await db.collection('attendances').countDocuments({
        employeeId: emp._id,
        shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' }
      });
      if (sepCount > 0) {
        const rec = await db.collection('attendances').findOne({
          employeeId: emp._id,
          shiftDate: '2026-09-01'
        });
        if (!rec) {
          console.log(`Missing 1st Sep: ${emp.fullName}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
