/**
 * modules/auth/login.service.js
 * Core login/refresh/logout logic — separate from session.service's CRUD
 * so the security-critical auth flow isn't buried in generic boilerplate.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const createHttpError = require('http-errors');
const Employee = require('../employees/employees.model');
const Session = require('./auth.model');
const { generateSecureToken } = require('../../utils/crypto');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    .populate('shiftId', 'name code startTime endTime graceMinutes workingDays isActive');
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
  const sessions = await Session.find({ revoked: false });
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
    .select('fullName role companyId branchId status shiftId')
    .populate('shiftId', 'name code startTime endTime graceMinutes workingDays isActive');

  if (!employee || employee.status !== 'active') {
    throw createHttpError(401, 'Account no longer active.');
  }

  return {
    id: employee._id,
    fullName: employee.fullName,
    role: employee.role,
    companyId: employee.companyId,
    branchId: employee.branchId,
    shift: employee.shiftId || null,
  };
}

module.exports = { login, refresh, logout, getCurrentUser, createSocketToken };
