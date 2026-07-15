/**
 * scripts/seed.js
 * Development seed — creates demo company + users for each role.
 * Run: node scripts/seed.js (from server directory, with MongoDB running)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Employee = require('../src/modules/employees/employees.model');
const Holiday = require('../src/modules/holidays/holidays.model');

const COMPANY_ID = new mongoose.Types.ObjectId('667788990011223344556677');

const DEMO_USERS = [
  { email: 'admin@hrms.demo', password: 'Admin@123', role: 'admin', fullName: 'System Admin', employeeCode: 'EMP001', department: 'Management', designation: 'Admin' },
  { email: 'hr@hrms.demo', password: 'Hr@123456', role: 'hr', fullName: 'Sara HR', employeeCode: 'EMP002', department: 'Human Resources', designation: 'HR Manager' },
  { email: 'employee@hrms.demo', password: 'Emp@12345', role: 'employee', fullName: 'Ali Employee', employeeCode: 'EMP003', department: 'Engineering', designation: 'Software Engineer' },
  { email: 'manager@hrms.demo', password: 'Mgr@12345', role: 'manager', fullName: 'Usman Manager', employeeCode: 'EMP004', department: 'Engineering', designation: 'Project Manager' },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await Employee.deleteMany({ companyId: COMPANY_ID });
  await Holiday.deleteMany({ companyId: COMPANY_ID });

  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await Employee.create({
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      email: user.email,
      cnic: '42101-1234567-1',
      joiningDate: new Date('2023-01-15'),
      department: user.department,
      designation: user.designation,
      role: user.role,
      passwordHash,
      companyId: COMPANY_ID,
      status: 'active',
      dateOfBirth: new Date('1995-06-15'),
    });
    console.log(`Created ${user.role}: ${user.email} / ${user.password}`);
  }

  const holidays = [
    { title: 'Pakistan Day', date: new Date('2026-03-23'), companyId: COMPANY_ID },
    { title: 'Eid ul Fitr', date: new Date('2026-04-10'), companyId: COMPANY_ID },
    { title: 'Independence Day', date: new Date('2026-08-14'), companyId: COMPANY_ID },
    { title: 'Defence Day', date: new Date('2026-09-06'), companyId: COMPANY_ID },
  ];
  await Holiday.insertMany(holidays);
  console.log(`Created ${holidays.length} holidays`);

  console.log('\nSeed complete. Login with any demo account above.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
