require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const db = mongoose.connection.db;
  const emp = await db.collection('employees').findOne({ fullName: /Muhammad Hassan Khan/i });
  const rec = await db.collection('attendances').findOne({ employeeId: emp._id, shiftDate: '2026-09-02' });
  
  await db.collection('attendances').updateOne(
    { _id: rec._id },
    { $set: { status: 'late' } }
  );
  console.log('Fixed record status to late.');
  process.exit(0);
});
