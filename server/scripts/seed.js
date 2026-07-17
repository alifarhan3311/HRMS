/**
 * Development seed: creates one randomized demo user for every supported role.
 * Run from the server directory with MongoDB running: npm run seed
 *
 * Re-running replaces users and holidays belonging to the fixed demo company.
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Employee = require('../src/modules/employees/employees.model');
const Holiday = require('../src/modules/holidays/holidays.model');

const COMPANY_ID = new mongoose.Types.ObjectId('667788990011223344556677');
const ROLES = [
  { role: 'super_admin', department: 'Executive', designation: 'Super Administrator' },
  { role: 'admin', department: 'Administration', designation: 'System Administrator' },
  { role: 'hr', department: 'Human Resources', designation: 'HR Manager' },
  { role: 'manager', department: 'Engineering', designation: 'Engineering Manager' },
  { role: 'team_lead', department: 'Engineering', designation: 'Team Lead' },
  { role: 'employee', department: 'Engineering', designation: 'Software Engineer' },
];

const FIRST_NAMES = ['Ali', 'Ayesha', 'Bilal', 'Fatima', 'Hamza', 'Hira', 'Omar', 'Sara'];
const LAST_NAMES = ['Ahmed', 'Khan', 'Malik', 'Raza', 'Sheikh', 'Siddiqui', 'Yousaf', 'Zafar'];

function randomItem(items) {
  return items[crypto.randomInt(items.length)];
}

function randomDigits(length) {
  return Array.from({ length }, () => crypto.randomInt(10)).join('');
}

function buildDemoUsers() {
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

  return ROLES.map((definition, index) => {
    const roleLabel = definition.role.replace('_', '');
    return {
      ...definition,
      email: `${roleLabel}.${runId}@hrms.demo`,
      password: `Hrms@${crypto.randomInt(100000, 999999)}${crypto.randomBytes(2).toString('hex')}`,
      fullName: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`,
      employeeCode: `DEMO-${String(index + 1).padStart(2, '0')}-${runId.toUpperCase()}`,
      cnic: `${randomDigits(5)}-${randomDigits(7)}-${randomDigits(1)}`,
    };
  });
}

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await Employee.deleteMany({ companyId: COMPANY_ID });
  await Holiday.deleteMany({ companyId: COMPANY_ID });

  const demoUsers = buildDemoUsers();
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await Employee.create({
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      email: user.email,
      cnic: user.cnic,
      joiningDate: new Date('2023-01-15'),
      department: user.department,
      designation: user.designation,
      role: user.role,
      passwordHash,
      companyId: COMPANY_ID,
      status: 'active',
      dateOfBirth: new Date('1995-06-15'),
    });
  }

  const holidays = [
    { title: 'Pakistan Day', date: new Date('2026-03-23'), companyId: COMPANY_ID },
    { title: 'Eid ul Fitr', date: new Date('2026-04-10'), companyId: COMPANY_ID },
    { title: 'Independence Day', date: new Date('2026-08-14'), companyId: COMPANY_ID },
    { title: 'Defence Day', date: new Date('2026-09-06'), companyId: COMPANY_ID },
  ];
  await Holiday.insertMany(holidays);

  console.table(demoUsers.map(({ role, fullName, email, password }) => ({
    role,
    name: fullName,
    email,
    password,
  })));
  console.log(`Seed complete: ${demoUsers.length} users and ${holidays.length} holidays created.`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
