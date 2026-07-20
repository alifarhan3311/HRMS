/**
 * modules/attendance/attendance.service.js
 * Attendance business logic:
 *  - Sign In / Sign Out with late detection
 *  - Office timing & grace period from persisted company settings
 *  - Manual attendance correction
 *  - Regularization request workflow
 *  - Monthly summary
 *  - Late policy: every 3 lates = 1 leave deduction
 */
const createHttpError = require('http-errors');
const repository = require('./attendance.repository');
const Employee = require('../employees/employees.model');
const settingsService = require('../companySettings/companySettings.service');
const notificationService = require('../notifications/notifications.service');
const { buildShiftSchedule, lateMinutes: calculateShiftLate, earlyLeaveMinutes: calculateShiftEarlyLeave } = require('./shiftTime');

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function splitTime(value, fallback) {
  const [hours, minutes] = String(value || fallback).split(':').map(Number);
  return { hours, minutes };
}

function calcLateMinutes(signInTime, timing) {
  const signIn = new Date(signInTime);
  if (timing.scheduledStart) {
    return calculateShiftLate(signIn, { scheduledStart: new Date(timing.scheduledStart) }, timing.graceMinutes || 0);
  }
  const officeStart = new Date(signIn);
  const start = splitTime(timing.officeStart, '09:00');
  officeStart.setHours(start.hours, start.minutes, 0, 0);
  const graceDeadline = new Date(officeStart.getTime() + timing.graceMinutes * 60 * 1000);

  if (signIn <= graceDeadline) return 0;
  return Math.round((signIn - graceDeadline) / 60000);
}

function calcEarlyLeaveMinutes(signOutTime, timing) {
  const signOut = new Date(signOutTime);
  if (timing.scheduledEnd) {
    return calculateShiftEarlyLeave(signOut, { scheduledEnd: new Date(timing.scheduledEnd) });
  }
  const officeEnd = new Date(signOut);
  const end = splitTime(timing.officeEnd, '18:00');
  officeEnd.setHours(end.hours, end.minutes, 0, 0);
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
  const now = new Date();
  const { shift, schedule } = await resolveShiftContext(employeeId, actor.companyId, now);
  if (!shift.workingDays.includes(schedule.dayOfWeek)) {
    throw createHttpError(422, `${shift.name} is not scheduled on this day. Contact HR if you need an exception.`);
  }
  const signInWindowStart = new Date(schedule.scheduledStart.getTime() - (4 * 60 * 60 * 1000));
  const signInWindowEnd = new Date(schedule.scheduledEnd.getTime() + (4 * 60 * 60 * 1000));
  if (now < signInWindowStart || now > signInWindowEnd) {
    throw createHttpError(422, `Sign-in is outside your ${shift.name} window (${shift.startTime} - ${shift.endTime}).`);
  }
  const [year, month, day] = schedule.shiftDate.split('-').map(Number);
  const attendanceDate = new Date(Date.UTC(year, month - 1, day, 12));
  const existing = await repository.findByEmployeeAndShiftDate(employeeId, schedule.shiftDate)
    || await repository.findByEmployeeAndDate(employeeId, attendanceDate);
  if (existing && existing.signInTime) {
    throw createHttpError(409, `You have already signed in for the ${schedule.shiftDate} shift.`);
  }

  const lateMinutes = calcLateMinutes(now, {
    scheduledStart: schedule.scheduledStart,
    graceMinutes: shift.graceMinutes,
  });
  const status = lateMinutes > 0 ? 'late' : 'present';

  const record = existing
    ? await repository.updateById(existing._id, {
        signInTime: now, status, lateMinutes, method, notes,
        shiftDate: schedule.shiftDate,
        shiftId: shift._id || undefined,
        shiftName: shift.name,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftGraceMinutes: shift.graceMinutes,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        shiftTimezone: schedule.timeZone,
      })
    : await repository.create({
        employeeId,
        date: attendanceDate,
        shiftDate: schedule.shiftDate,
        shiftId: shift._id || undefined,
        shiftName: shift.name,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftGraceMinutes: shift.graceMinutes,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        shiftTimezone: schedule.timeZone,
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
  const record = await repository.findOpenByEmployee(employeeId);
  if (!record) throw createHttpError(400, 'No open shift sign-in record was found.');
  if (record.signOutTime) throw createHttpError(409, 'You have already signed out today.');

  const now = new Date();
  const settings = await settingsService.getPolicy(actor.companyId);
  const earlyLeaveMinutes = calcEarlyLeaveMinutes(now, recordTiming(record, settings.timing));
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
async function getTodayAttendance(employeeId, actor) {
  const openRecord = await repository.findOpenByEmployee(employeeId);
  if (openRecord) return openRecord;
  const { shift, schedule } = await resolveShiftContext(employeeId, actor.companyId);
  const record = await repository.findByEmployeeAndShiftDate(employeeId, schedule.shiftDate);
  if (record) return record;
  return {
    shiftDate: schedule.shiftDate,
    shiftName: shift.name,
    shiftStartTime: shift.startTime,
    shiftEndTime: shift.endTime,
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    shiftTimezone: schedule.timeZone,
  };
}

async function resolveShiftContext(employeeId, companyId, now = new Date()) {
  const [employee, settings] = await Promise.all([
    Employee.findOne({ _id: employeeId, companyId }).populate('shiftId'),
    settingsService.getPolicy(companyId),
  ]);
  if (!employee) throw createHttpError(404, 'Employee not found.');
  if (employee.shiftId && !employee.shiftId.isActive) {
    throw createHttpError(422, 'Your assigned shift is inactive. Please contact HR.');
  }
  const shift = employee.shiftId || {
    _id: null,
    name: 'General Shift', code: 'GENERAL',
    startTime: settings.timing.officeStart, endTime: settings.timing.officeEnd,
    graceMinutes: settings.timing.graceMinutes,
    workingDays: [0, 1, 2, 3, 4, 5, 6].filter(day => !settings.timing.weekendDays.includes(day)),
    isActive: true,
  };
  const timeZone = settings.company?.timezone || 'Asia/Karachi';
  return { employee, shift, schedule: buildShiftSchedule(now, shift, timeZone) };
}

function recordTiming(record, fallback) {
  if (record.scheduledStart || record.scheduledEnd) return {
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
    graceMinutes: record.shiftGraceMinutes || 0,
  };
  return fallback;
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
    const canViewOthers = ['super_admin', 'hr', 'manager', 'team_lead'].includes(actor.role);
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

  // Users without HR/team authority only see their own records.
  if (!['hr', 'super_admin', 'manager', 'team_lead'].includes(actor.role)) {
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
  const settings = await settingsService.getPolicy(record.companyId);
  const update = { notes };
  const correctedSignIn = signInTime ? new Date(signInTime) : record.signInTime;
  const correctedSignOut = signOutTime ? new Date(signOutTime) : record.signOutTime;

  if (correctedSignIn && correctedSignOut && correctedSignOut <= correctedSignIn) {
    throw createHttpError(422, 'Sign-out time must be after sign-in time.');
  }

  if (signInTime) {
    update.signInTime = correctedSignIn;
    update.lateMinutes = calcLateMinutes(signInTime, recordTiming(record, settings.timing));
    update.status = update.lateMinutes > 0 ? 'late' : (status || 'present');
  }
  if (signOutTime) {
    update.signOutTime = correctedSignOut;
    update.earlyLeaveMinutes = calcEarlyLeaveMinutes(signOutTime, recordTiming(record, settings.timing));
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
async function resolveRegularizationApprover(employee, companyId) {
  if (employee.teamLeadId) return employee.teamLeadId;
  if (employee.managerId) return employee.managerId;

  const fallback = await Employee.findOne({
    companyId,
    role: { $in: ['hr', 'super_admin'] },
    status: 'active',
  }).select('_id');
  return fallback?._id;
}

async function requestRegularization(id, payload, actor) {
  const { reason, requestType, requestedSignInTime, requestedSignOutTime } = payload;
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  if (String(record.employeeId._id || record.employeeId) !== String(actor.id)) {
    throw createHttpError(403, 'You can only regularize your own attendance.');
  }
  if (record.regularizationStatus !== 'none') {
    throw createHttpError(409, 'A regularization request already exists for this record.');
  }
  if (requestType === 'late_waiver' && record.lateMinutes <= 0) {
    throw createHttpError(422, 'A late waiver can only be requested for a late attendance record.');
  }

  const employee = await Employee.findById(actor.id).select('managerId teamLeadId companyId fullName');
  const assignedApprover = await resolveRegularizationApprover(employee, actor.companyId);
  if (!assignedApprover) {
    throw createHttpError(422, 'No manager, team lead, HR, or super administrator is available to review this request.');
  }

  await repository.updateById(id, {
    regularizationStatus: 'pending',
    regularization: {
      requestedBy: actor.id,
      requestType,
      reason,
      requestedAt: new Date(),
      requestedSignInTime: requestedSignInTime ? new Date(requestedSignInTime) : undefined,
      requestedSignOutTime: requestedSignOutTime ? new Date(requestedSignOutTime) : undefined,
      assignedApprover,
    },
  });

  await notificationService.createNotification({
    recipientId: assignedApprover,
    companyId: actor.companyId,
    type: 'attendance_regularization_requested',
    title: requestType === 'late_waiver' ? 'Late waiver approval required' : 'Attendance correction approval required',
    message: `${employee.fullName} submitted a request for ${record.date.toLocaleDateString()}.`,
    link: '/attendance',
    metadata: { attendanceId: record._id, requestType },
    dedupeKey: `attendance-regularization-requested:${record._id}`,
  });

  return repository.findById(id);
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

  const elevatedReviewer = ['super_admin', 'hr'].includes(actor.role);
  const assignedId = record.regularization?.assignedApprover?._id
    || record.regularization?.assignedApprover;
  if (!elevatedReviewer && String(assignedId) !== String(actor.id)) {
    throw createHttpError(403, 'This request is assigned to another approver.');
  }

  const update = {
    regularizationStatus: action === 'approve' ? 'approved' : 'rejected',
    'regularization.reviewedBy': actor.id,
    'regularization.reviewedAt': new Date(),
    'regularization.remarks': remarks || '',
  };

  if (action === 'approve') {
    if (record.regularization.requestType === 'late_waiver') {
      update.lateMinutes = 0;
      if (record.status === 'late') update.status = 'present';
      update.notes = `${record.notes || ''} [Late waived by ${actor.fullName || actor.email}]`.trim();
      await Employee.updateOne(
        { _id: record.employeeId._id || record.employeeId, lateCount: { $gt: 0 } },
        { $inc: { lateCount: -1 } },
      );
    } else {
      const settings = await settingsService.getPolicy(record.companyId);
      const correctedSignIn = record.regularization.requestedSignInTime || record.signInTime;
      const correctedSignOut = record.regularization.requestedSignOutTime || record.signOutTime;
      if (correctedSignIn) {
        update.signInTime = correctedSignIn;
        update.lateMinutes = calcLateMinutes(correctedSignIn, recordTiming(record, settings.timing));
        update.status = update.lateMinutes > 0 ? 'late' : 'present';
      }
      if (correctedSignOut) {
        update.signOutTime = correctedSignOut;
        update.earlyLeaveMinutes = calcEarlyLeaveMinutes(correctedSignOut, recordTiming(record, settings.timing));
      }
      if (correctedSignIn && correctedSignOut) {
        if (new Date(correctedSignOut) <= new Date(correctedSignIn)) {
          throw createHttpError(422, 'Corrected sign-out time must be after sign-in time.');
        }
        update.totalHours = calcTotalHours(correctedSignIn, correctedSignOut);
      }
    }
  }

  await repository.updateById(id, update);

  await notificationService.createNotification({
    recipientId: record.employeeId._id || record.employeeId,
    companyId: record.companyId,
    type: `attendance_regularization_${action === 'approve' ? 'approved' : 'rejected'}`,
    title: `Attendance request ${action === 'approve' ? 'approved' : 'rejected'}`,
    message: `${actor.fullName || 'Your approver'} ${action === 'approve' ? 'approved' : 'rejected'} your ${record.regularization.requestType.replace('_', ' ')} request.`,
    link: '/attendance',
    metadata: { attendanceId: record._id, reviewedBy: actor.id },
    dedupeKey: `attendance-regularization-${action}:${record._id}`,
  });

  return repository.findById(id);
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
