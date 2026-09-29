require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const repository = require('./src/modules/attendance/attendance.repository.js');
  
  try {
    const res = await repository.findAll({ 
      filter: { shiftDate: { $gte: '2026-09-01', $lte: '2026-09-30' } }, 
      page: 1, 
      limit: 10, 
      sort: '-shiftDate' 
    });
    console.log('Result count:', res.items.length);
  } catch (error) {
    console.error('Error:', error);
  }
  
  mongoose.disconnect();
}).catch(console.error);
