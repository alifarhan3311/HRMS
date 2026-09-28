const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
dotenv.config();

const Employee = require('./src/modules/employees/employees.model');

mongoose.connect(process.env.MONGO_URI, { dbName: 'test' }).then(async () => {
  const emps = await Employee.find({ fullName: { $regex: /eshan|ayan|abbas|jaffari|bilal|hassan/i } }).select('fullName department status shiftId').lean();
  console.log(emps);
  mongoose.disconnect();
});
