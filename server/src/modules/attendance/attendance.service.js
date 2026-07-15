/**
 * modules/attendance/attendance.service.js
 * Attendance business logic:
 *  - Sign In / Sign Out with late detection
 *  - Office timing & grace period from company settings (env-based defaults)
 *  - Manual attendance correction
 *  - Regularization request workflow
 *  - Monthly summary
 *  - Late policy: every 3 lates = 1 leave deduction
 */
const createHttpError = require('http-errors');
const repository = require('./attendance.repository');
const Employee = require('../employees/employees.model');

// Configurable defaults (should come from Company Settings in production)
const OFFICE_START_HOUR = parseInt(process.env.OFFICE_START_HOUR || '9', 10);
const OFFICE_START_MINUTE = parseInt(process.env.OFFICE_START_MINUTE || '0', 10);
const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '15', 10);
const OFFICE_END_HOUR = parseInt(process.env.OFFICE_END_HOUR || '18', 10);
const OFFICE_END_MINUTE = parseInt(process.env.OFFICE_END_MINUTE || '0', 10);

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcLateMinutes(signInTime) {
  const signIn = new Date(signInTime);
  const officeStart = new Date(signIn);
  officeStart.setHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);
  const graceDeadline = new Date(officeStart.getTime() + GRACE_MINUTES * 60 * 1000);

  if (signIn <= graceDeadline) return 0;
  return Math.round((signIn - graceDeadline) / 60000);
}

function calcEarlyLeaveMinutes(signOutTime) {
  const signOut = new Date(signOutTime);
  const officeEnd = new Date(signOut);
  officeEnd.setHours(OFFICE_END_HOUR, OFFICE_END_MINUTE, 0, 0);
  if (signOut >= officeEnd) return 0;
  return Math.round((officeEnd - signOut) / 60000);
}

function calcTotalHours(signIn, signOut) {
  if (!signIn || !signOut) return 0;
  const ms = new Date(signOut) - new Date(signIn);
  return Math.round((ms / 3600000) * 100) / 100; // round to 2 decimal places
}

// -------------------------------------------------------------------------
// Sign In
// -------------------------------------------------------------------------
async function signIn({ employeeId, method = 'manual', notes }, actor) {
  const today = startOfDay();
  const existing = await repository.findByEmployeeAndDate(employeeId, today);
  if (existing && existing.signInTime) {
    throw createHttpError(409, 'You have already signed in today.');
  }

  const now = new Date();
  const lateMinutes = calcLateMinutes(now);
  const status = lateMinutes > 0 ? 'late' : 'present';

  const record = existing
    ? await repository.updateById(existing._id, { signInTime: now, status, lateMinutes, method, notes })
    : await repository.create({
        employeeId,
        date: today,
        signInTime: now,
        status,
        lateMinutes,
        method,
        notes,
        companyId: actor.companyId,
        branchId: actor.branchId,
      });

  // Update employee's lateCount if late
  if (lateMinutes > 0) {
    await Employee.findByIdAndUpdate(employeeId, { $inc: { lateCount: 1 } });
    // Check if late count hits multiple of 3 — trigger leave deduction notification
    const emp = await Employee.findById(employeeId);
    if (emp && emp.lateCount % 3 === 0) {
      // In production: emit a BullMQ job to deduct leave and send notification
      // For now we note it in the record
      await repository.updateById(record._id, {
        notes: (notes || '') + ' [Late policy: 3rd late mark — 1 leave deduction pending]',
      });
    }
  }

  return record;
}

// -------------------------------------------------------------------------
// Sign Out
// -------------------------------------------------------------------------
async function signOut({ employeeId, notes }, actor) {
  const today = startOfDay();
  const record = await repository.findByEmployeeAndDate(employeeId, today);
  if (!record) throw createHttpError(400, 'No sign-in record found for today.');
  if (record.signOutTime) throw createHttpError(409, 'You have already signed out today.');

  const now = new Date();
  const earlyLeaveMinutes = calcEarlyLeaveMinutes(now);
  const totalHours = calcTotalHours(record.signInTime, now);

  const updated = await repository.updateById(record._id, {
    signOutTime: now,
    earlyLeaveMinutes,
    totalHours,
    ...(notes && { notes }),
  });

  return updated;
}

// -------------------------------------------------------------------------
// Today's Attendance for current user
// -------------------------------------------------------------------------
async function getTodayAttendance(employeeId) {
  const today = startOfDay();
  return repository.findByEmployeeAndDate(employeeId, today);
}

async function getAttendanceById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  return record;
}

// -------------------------------------------------------------------------
// Monthly Summary
// -------------------------------------------------------------------------
async function getMonthlySummary(employeeId, year, month, actor) {
  if (String(employeeId) !== String(actor.id)) {
    const canViewOthers = ['super_admin', 'admin', 'hr', 'manager', 'team_lead'].includes(actor.role);
    if (!canViewOthers) {
      throw createHttpError(403, 'You can only view your own attendance summary.');
    }

    const employee = await Employee.findById(employeeId).select('companyId');
    const sameCompany = employee && String(employee.companyId) === String(actor.companyId);
    if (!employee || (actor.role !== 'super_admin' && !sameCompany)) {
      throw createHttpError(404, 'Employee not found.');
    }
  }

  const records = await repository.getMonthlySummary(employeeId, year, month);
  const summary = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, holiday: 0 };
  records.forEach((r) => { if (summary[r.status] !== undefined) summary[r.status]++; });
  return { records, summary };
}

// -------------------------------------------------------------------------
// List (Admin/HR view with filters)
// -------------------------------------------------------------------------
async function listAttendances(query, actor) {
  const {
    page = 1, limit = 30, sort = '-date',
    employeeId, status, dateFrom, dateTo, month, year,
  } = query;

  const filter = { companyId: actor.companyId };

  // Non-admin/hr: employees only see their own
  if (!['admin', 'hr', 'super_admin', 'manager', 'team_lead'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }

  if (status) filter.status = status;

  if (month && year) {
    filter.date = {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0, 23, 59, 59, 999),
    };
  } else if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 100), sort });
}

// -------------------------------------------------------------------------
// Manual attendance correction (HR/Admin)
// -------------------------------------------------------------------------
async function manualCorrection(id, payload, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');

  const { signInTime, signOutTime, status, notes } = payload;
  const update = { notes };
  const correctedSignIn = signInTime ? new Date(signInTime) : record.signInTime;
  const correctedSignOut = signOutTime ? new Date(signOutTime) : record.signOutTime;

  if (correctedSignIn && correctedSignOut && correctedSignOut <= correctedSignIn) {
    throw createHttpError(422, 'Sign-out time must be after sign-in time.');
  }

  if (signInTime) {
    update.signInTime = correctedSignIn;
    update.lateMinutes = calcLateMinutes(signInTime);
    update.status = update.lateMinutes > 0 ? 'late' : (status || 'present');
  }
  if (signOutTime) {
    update.signOutTime = correctedSignOut;
    update.earlyLeaveMinutes = calcEarlyLeaveMinutes(signOutTime);
  }
  if ((signInTime || signOutTime) && correctedSignIn && correctedSignOut) {
    update.totalHours = calcTotalHours(correctedSignIn, correctedSignOut);
  }
  if (status) update.status = status;

  const updated = await repository.updateById(id, update);
  return updated;
}

// -------------------------------------------------------------------------
// Regularization request (Employee)
// -------------------------------------------------------------------------
async function requestRegularization(id, { reason }, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  if (String(record.employeeId._id || record.employeeId) !== String(actor.id)) {
    throw createHttpError(403, 'You can only regularize your own attendance.');
  }
  if (record.regularizationStatus !== 'none') {
    throw createHttpError(409, 'A regularization request already exists for this record.');
  }

  const updated = await repository.updateById(id, {
    regularizationStatus: 'pending',
    regularization: {
      requestedBy: actor.id,
      reason,
      requestedAt: new Date(),
    },
  });
  return updated;
}

// -------------------------------------------------------------------------
// Approve / Reject regularization (HR/Admin)
// -------------------------------------------------------------------------
async function reviewRegularization(id, { action, remarks }, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  if (record.regularizationStatus !== 'pending') {
    throw createHttpError(400, 'No pending regularization for this record.');
  }

  const updated = await repository.updateById(id, {
    regularizationStatus: action === 'approve' ? 'approved' : 'rejected',
    'regularization.reviewedBy': actor.id,
    'regularization.reviewedAt': new Date(),
    'regularization.remarks': remarks || '',
  });
  return updated;
}

// -------------------------------------------------------------------------
// Get pending regularizations (HR/Admin)
// -------------------------------------------------------------------------
async function getPendingRegularizations(actor) {
  return repository.getPendingRegularizations(actor.companyId);
}

module.exports = {
  signIn,
  signOut,
  getTodayAttendance,
  getAttendanceById,
  getMonthlySummary,
  listAttendances,
  manualCorrection,
  requestRegularization,
  reviewRegularization,
  getPendingRegularizations,
};
