/**
 * One-time production bootstrap for the first Super Admin.
 *
 * This script never deletes or replaces existing records. It refuses to
 * create another Super Admin for the same company.
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Employee = require('../src/modules/employees/employees.model');

const DEFAULT_COMPANY_ID = '667788990011223344556677';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function randomDigits(length) {
  return Array.from({ length }, () => crypto.randomInt(10)).join('');
}

async function bootstrap() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is required.');

  const email = required('BOOTSTRAP_SUPER_ADMIN_EMAIL').toLowerCase();
  const password = required('BOOTSTRAP_SUPER_ADMIN_PASSWORD');
  const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || 'Super Admin';
  const companyId = process.env.BOOTSTRAP_COMPANY_ID || DEFAULT_COMPANY_ID;

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Bootstrap email is invalid.');
  const passwordIsStrong =
    password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
  const weakPasswordExplicitlyAllowed = process.env.BOOTSTRAP_ALLOW_WEAK_PASSWORD === 'true';
  if (!passwordIsStrong && !weakPasswordExplicitlyAllowed) {
    throw new Error('Bootstrap password needs 8+ characters, uppercase, lowercase, and a number.');
  }
  if (password.length < 8) throw new Error('Bootstrap password must contain at least 8 characters.');
  if (!passwordIsStrong) {
    console.warn('Warning: creating Super Admin with an explicitly allowed weak password.');
  }
  if (!mongoose.isValidObjectId(companyId)) throw new Error('BOOTSTRAP_COMPANY_ID is invalid.');

  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });

  const existingSuperAdmin = await Employee.findOne({ companyId, role: 'super_admin' });
  if (existingSuperAdmin) {
    console.log(`Super Admin already exists for this company: ${existingSuperAdmin.email}`);
    return;
  }

  const existingEmail = await Employee.findOne({ email });
  if (existingEmail) throw new Error('An employee with this email already exists.');

  await Employee.create({
    employeeCode: `SA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    fullName,
    email,
    cnic: `${randomDigits(5)}-${randomDigits(7)}-${randomDigits(1)}`,
    joiningDate: new Date(),
    department: 'Executive',
    designation: 'Super Administrator',
    role: 'super_admin',
    passwordHash: await bcrypt.hash(password, 12),
    companyId,
    status: 'active',
  });

  console.log(`Super Admin created successfully: ${email}`);
}

bootstrap()
  .catch((error) => {
    console.error(`Bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
