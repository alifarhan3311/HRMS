require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  try {
    const db = mongoose.connection.db;
    const count = await db.collection('attendances').countDocuments({});
    console.log(`Total attendance records in DB: ${count}`);
    const someRec = await db.collection('attendances').findOne({});
    console.log('Sample record:', someRec);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
