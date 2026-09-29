require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://developerhrms2026:i34aX6r5h3a4TFTu@hrms.c0z6z.mongodb.net/HRMS_NEW_DB_PROD?retryWrites=true&w=majority')
  .then(async () => {
    const Attendance = require('./src/modules/attendance/attendance.model.js');
    const result = await Attendance.updateMany(
      { 
        status: 'absent', 
        missedPunchType: 'sign_out', 
        $or: [ { signInTime: { $exists: false } }, { signInTime: null } ] 
      },
      { $unset: { missedPunchType: '', autoClosedAt: '' } }
    );
    console.log(result);
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
