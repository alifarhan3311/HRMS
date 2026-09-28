const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI, { family: 4 }).then(async () => {
  const Holiday = require('./src/modules/holidays/holidays.model');
  const allH = await Holiday.find({});
  console.log('All holidays:', allH.map(x => ({ title: x.title, date: x.date, eventType: x.eventType, status: x.status })));
  process.exit();
}).catch(console.error);
