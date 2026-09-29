const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/attendance?page=1&limit=100&dateFrom=2026-09-01&dateTo=2026-09-30',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log('Result total:', json.total, 'items length:', json.items?.length);
    } catch (e) {
      console.log('Body:', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
