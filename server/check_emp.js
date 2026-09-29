require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const db = mongoose.connection.db;
  const hr = await db.collection('employees').findOne({ role: 'hr' });
  const emp = await db.collection('employees').findOne({ fullName: /Syed Muhammad Ayaz/i });
  console.log('HR companyId:', hr.companyId);
  console.log('Emp companyId:', emp.companyId);
  
  process.exit(0);
});
