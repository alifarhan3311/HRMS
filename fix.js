const fs = require('fs');
let code = fs.readFileSync('client/src/features/payroll/pages/PayrollListPage.jsx', 'utf8');
code = code.replace(/\\"/g, '"');
fs.writeFileSync('client/src/features/payroll/pages/PayrollListPage.jsx', code);
