/**
 * modules/auth/login.service.js
 * Core login/refresh/logout logic — separate from session.service's CRUD
 * so the security-critical auth flow isn't buried in generic boilerplate.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const Employee = require('../employees/employees.model');
const Shift = require('../shifts/shifts.model');
const Session = require('./auth.model');
const { decryptField, generateSecureToken } = require('../../utils/crypto');
const logger = require('../../utils/logger');

// Access tokens remain short-lived and are silently renewed by the client.
// The refresh session is deliberately longer so normal staff do not have to
// sign in again during (or between) working days. Both values can be adjusted
// per deployment without changing code.
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_TOKEN_TTL_DAYS = Math.max(
  1,
  Number.parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10) || 30
);
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function signAccessToken(employee) {
  return jwt.sign(
    {
      sub: employee._id,
      role: employee.role,
      companyId: employee.companyId,
      branchId: employee.branchId,
      tokenVersion: employee.tokenVersion || 0,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function login({ email, password, userAgent, ipAddress }) {
  const employee = await Employee.findOne({ email })
    .select('+passwordHash')
    .populate('shiftId', 'name code shiftType startTime endTime graceMinutes lateHalfDayAfterMinutes requiredMinutes breakMinutes halfDayMinutes overtimeAfterMinutes workingDays isActive');
  if (!employee || employee.status !== 'active') {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, employee.passwordHash);
  if (!passwordMatches) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  const rawRefreshToken = generateSecureToken(48);
  const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

  await Session.create({
    employeeId: employee._id,
    refreshTokenHash,
    userAgent,
    ipAddress,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  const accessToken = signAccessToken(employee);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: employee._id,
      fullName: employee.fullName,
      role: employee.role,
      companyId: employee.companyId,
      branchId: employee.branchId,
      shift: employee.shiftId || null,
    },
  };
}

async function refresh({ rawRefreshToken }) {
  if (!rawRefreshToken) throw createHttpError(401, 'No refresh token provided.');

  // NOTE: in a real deployment, index sessions by employeeId (embedded in
  // an unsigned reference cookie or short-lived lookup) to avoid a full
  // collection scan when matching the bcrypt hash. Simplified here.
  const candidateSessions = await Session.find({
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).limit(500);

  const bcrypt_ = require('bcrypt');
  let matchedSession = null;
  for (const session of candidateSessions) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt_.compare(rawRefreshToken, session.refreshTokenHash)) {
      matchedSession = session;
      break;
    }
  }

  if (!matchedSession) {
    throw createHttpError(401, 'Invalid or expired refresh token.');
  }

  const employee = await Employee.findById(matchedSession.employeeId);
  if (!employee || employee.status !== 'active') {
    throw createHttpError(401, 'Account no longer active.');
  }

  const accessToken = signAccessToken(employee);
  return { accessToken };
}

async function logout({ rawRefreshToken }) {
  if (!rawRefreshToken) return;
  const sessions = await Session.find({
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).limit(500);
  const bcrypt_ = require('bcrypt');
  for (const session of sessions) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt_.compare(rawRefreshToken, session.refreshTokenHash)) {
      session.revoked = true;
      // eslint-disable-next-line no-await-in-loop
      await session.save();
      break;
    }
  }
}

function createSocketToken(actor) {
  return jwt.sign(
    {
      sub: actor.id,
      role: actor.role,
      companyId: actor.companyId,
      branchId: actor.branchId,
      scope: 'socket',
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

async function getCurrentUser(employeeId) {
  const employee = await Employee.findById(employeeId)
    .select('-passwordHash -__v')
    // Read the stored values without schema getters first. Older production
    // records may contain plaintext fields, while records encrypted with a
    // previous master key must not make the entire /auth/me request fail.
    .lean({ getters: false, virtuals: false });

  if (!employee || employee.status !== 'active') {
    throw createHttpError(401, 'Account no longer active.');
  }

  const user = { ...employee };
  for (const field of ['cnic', 'contactNumber', 'address', 'currentSalary', 'emergencyContact']) {
    const storedValue = employee[field];
    if (storedValue === null || storedValue === undefined || storedValue === '') continue;

    // Before field encryption was introduced these values were stored as
    // plaintext. Preserve those legacy values and decrypt only ciphertext
    // bundles matching the current storage format.
    if (typeof storedValue !== 'string' || storedValue.split(':').length !== 3) continue;

    try {
      user[field] = decryptField(storedValue);
    } catch (error) {
      // A stale/mismatched deployment key should redact only the affected
      // field. Authentication and the rest of the employee profile remain
      // usable, and operators get a diagnostic without leaking PII.
      user[field] = null;
      logger.error('[auth] Could not decrypt employee profile field', {
        employeeId: String(employee._id),
        field,
        error: error.message,
      });
    }
  }

  // Resolve optional references independently. A malformed/deleted legacy
  // manager, team-lead or shift reference must not turn authentication into
  // a 500 response and lock the employee out of the entire application.
  const safeReference = async (Model, id, select, field) => {
    if (!id || !mongoose.isValidObjectId(id)) return null;
    try {
      return await Model.findById(id).select(select).lean();
    } catch (error) {
      logger.error('[auth] Could not load employee profile reference', {
        employeeId: String(employee._id),
        field,
        referenceId: String(id),
        error: error.message,
      });
      return null;
    }
  };

  const [manager, teamLead, shift] = await Promise.all([
    safeReference(Employee, employee.managerId, 'fullName employeeCode designation', 'managerId'),
    safeReference(Employee, employee.teamLeadId, 'fullName employeeCode designation', 'teamLeadId'),
    safeReference(
      Shift,
      employee.shiftId,
      'name code shiftType startTime endTime graceMinutes lateHalfDayAfterMinutes requiredMinutes breakMinutes halfDayMinutes overtimeAfterMinutes workingDays isActive',
      'shiftId'
    ),
  ]);

  user.managerId = manager;
  user.teamLeadId = teamLead;
  user.id = employee._id;
  user.shiftId = shift;
  user.shift = shift;
  delete user.passwordHash;
  return user;
}

async function updateProfile(employeeId, payload) {
  const employee = await Employee.findByIdAndUpdate(employeeId, payload, {
    new: true,
    runValidators: true,
  });
  if (!employee || employee.status !== 'active') throw createHttpError(404, 'Employee profile not found.');
  return getCurrentUser(employeeId);
}

async function changePassword(employeeId, { currentPassword, newPassword }) {
  const employee = await Employee.findById(employeeId).select('+passwordHash');
  if (!employee || employee.status !== 'active') throw createHttpError(404, 'Employee account not found.');
  if (!(await bcrypt.compare(currentPassword, employee.passwordHash))) {
    throw createHttpError(422, 'Current password is incorrect.');
  }
  if (await bcrypt.compare(newPassword, employee.passwordHash)) {
    throw createHttpError(422, 'New password must be different from the current password.');
  }
  employee.passwordHash = await bcrypt.hash(newPassword, 12);
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  await employee.save();
  await Session.updateMany({ employeeId, revoked: false }, { $set: { revoked: true } });
}

module.exports = {
  login, refresh, logout, getCurrentUser, createSocketToken, updateProfile, changePassword,
};
