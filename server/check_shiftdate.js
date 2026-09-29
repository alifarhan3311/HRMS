require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, {strict:false}), 'attendances');
  const total = await Attendance.countDocuments({});
  const withShiftDate = await Attendance.countDocuments({ shiftDate: { $exists: true, $ne: null } });
  const withoutShiftDate = total - withShiftDate;
  console.log('Total:', total);
  console.log('With shiftDate:', withShiftDate);
  console.log('Without shiftDate:', withoutShiftDate);
  
  // Check a sample without shiftDate
  const sample = await Attendance.findOne({ shiftDate: { $exists: false } });
  if (sample) console.log('Sample without shiftDate:', JSON.stringify({ date: sample.date, status: sample.status }));
  
  mongoose.disconnect();
}).catch(console.error);
