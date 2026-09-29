const http = require('http');

require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://alifarhan1531_db_user:UAFzkXOXbExwqfAv@cluster0.znr91qg.mongodb.net/?appName=Cluster0').then(async () => {
  const db = mongoose.connection.db;
  const hr = await db.collection('employees').findOne({ role: 'hr' });
  const token = jwt.sign({ id: hr._id, role: hr.role, companyId: hr.companyId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
  
  const postData = JSON.stringify({
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/bulk-recovery',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log('Body:', data);
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
  });
  req.write(postData);
  req.end();
});
