require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  try {
    const db = mongoose.connection.db;
    const employee = await db.collection('employees').findOne({ fullName: /Muhammad Hassan/i });
    if (employee) {
      const records = await db.collection('attendances').find({
        employeeId: employee._id,
        shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' }
      }).toArray();
      const dates = records.map(r => r.shiftDate);
      for (let i = 1; i <= 30; i++) {
        const d = `2026-09-${String(i).padStart(2, '0')}`;
        if (!dates.includes(d)) {
          console.log("Missing date:", d);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
