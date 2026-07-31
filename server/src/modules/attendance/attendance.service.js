/**
 * modules/attendance/attendance.service.js
 * Attendance business logic:
 *  - Sign In / Sign Out with late detection
 *  - Office timing & grace period from persisted company settings
 *  - Manual attendance correction
 *  - Regularization request workflow
 *  - Monthly summary
 *  - Late tracking for employee-requested leave conversion
 */
const createHttpError = require('http-errors');
const repository = require('./attendance.repository');
const Employee = require('../employees/employees.model');
const {
  buildManagerEmployeeScope,
  managerCanAccessEmployee,
} = require('../employees/managerScope');
const { normalizeDurationPolicy } = require('../shifts/shifts.service');
const settingsService = require('../companySettings/companySettings.service');
const notificationService = require('../notifications/notifications.service');
const {
  buildShiftSchedule,
  buildFlexibleSchedule,
  lateMinutes: calculateShiftLate,
  arrivalStatus: calculateArrivalStatus,
  earlyLeaveMinutes: calculateShiftEarlyLeave,
} = require('./shiftTime');
const { appliesToEmployee, findClosure, effectivePolicy } = require('./closurePolicy');
const { isSaturdayShiftDate, saturdayStatus } = require('./saturdayPolicy');
const {
  normalizeWorkMode,
  canUseSelfServiceSignIn,
  buildWorkModeFilter,
} = require('./workModePolicy');

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
  return Math.floor((signIn - graceDeadline) / 60000);
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

function completionToleranceMinutes(record, requiredMinutes) {
  return (record.shiftType || 'fixed') === 'fixed' && Number(requiredMinutes) > 420 ? 15 : 0;
}

function correctedWorkMetrics(record, signIn, signOut, lateMinutes = 0) {
  const clockMinutes = Math.max(0, Math.round((new Date(signOut) - new Date(signIn)) / 60000));
  const workedMinutes = clockMinutes;
  const requiredMinutes = Number(record.effectiveRequiredMinutes || record.shiftRequiredMinutes || 480);
  const halfDayMinutes = Number(record.shiftHalfDayMinutes || Math.ceil(requiredMinutes / 2));
  return {
    totalHours: Number((clockMinutes / 60).toFixed(2)),
    workedMinutes,
    overtimeMinutes: Math.max(0, workedMinutes - Number(record.shiftOvertimeAfterMinutes || requiredMinutes)),
    status: attendanceStatus(
      lateMinutes > 0 ? 'late' : 'present',
      workedMinutes,
      requiredMinutes,
      halfDayMinutes,
      false,
      completionToleranceMinutes(record, requiredMinutes),
    ),
  };
}

// -------------------------------------------------------------------------
// Sign In
// -------------------------------------------------------------------------
async function signIn({
  employeeId,
  method = 'manual',
  notes,
  punchTime,
  allowOfficeAttendance = false,
}, actor) {
  const now = punchTime ? new Date(punchTime) : new Date();
  const { employee, shift, schedule } = await resolveShiftContext(employeeId, actor.companyId, now);
  if (!allowOfficeAttendance && !canUseSelfServiceSignIn(employee)) {
    throw createHttpError(403, 'Self-service sign-in is available only to Work From Home employees.');
  }
  const workMode = normalizeWorkMode(employee.workMode);
  const attendanceExempt = employee.role === 'super_admin';
  const closure = await findClosure(employee, actor.companyId, schedule.shiftDate);
  if (!attendanceExempt && (closure?.eventType === 'full_day' || (closure && !closure.eventType))) {
    throw createHttpError(422, `${closure.title} is a confirmed company off day. Sign-in is not required.`);
  }
  if (!attendanceExempt && !shift.workingDays.includes(schedule.dayOfWeek)) {
    throw createHttpError(422, `${shift.name} is not scheduled on this day. Contact HR if you need an exception.`);
  }
  const isFlexible = shift.shiftType === 'flexible';
  const signInWindowStart = new Date(schedule.scheduledStart.getTime() - (4 * 60 * 60 * 1000));
  const signInWindowEnd = new Date(schedule.scheduledEnd.getTime() + (4 * 60 * 60 * 1000));
  if (method !== 'biometric' && !attendanceExempt && !isFlexible && (now < signInWindowStart || now > signInWindowEnd)) {
    throw createHttpError(422, `Sign-in is outside your ${shift.name} window (${shift.startTime} - ${shift.endTime}).`);
  }
  const [year, month, day] = schedule.shiftDate.split('-').map(Number);
  const attendanceDate = new Date(Date.UTC(year, month - 1, day, 12));
  const existing = await repository.findByEmployeeAndShiftDate(employeeId, schedule.shiftDate)
    || await repository.findByEmployeeAndDate(employeeId, attendanceDate);
  if (existing && existing.signInTime) {
    throw createHttpError(409, `You have already signed in for the ${schedule.shiftDate} shift.`);
  }

  const policy = effectivePolicy(attendanceExempt ? null : closure, shift, schedule);
  const saturdayPolicy = isSaturdayShiftDate(schedule.shiftDate);
  const arrival = attendanceExempt || saturdayPolicy
    ? { status: 'present', lateMinutes: 0 }
    : calculateArrivalStatus(now, { scheduledStart: policy.effectiveStart }, shift);
  const lateMinutes = arrival.lateMinutes;
  const status = arrival.status;

  const record = existing
    ? await repository.updateById(existing._id, {
        signInTime: now, status, lateMinutes, method, notes,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        workMode,
        shiftDate: schedule.shiftDate,
        shiftId: shift._id || undefined,
        shiftName: shift.name,
        employeeDepartment: employee.department,
        shiftType: shift.shiftType || 'fixed',
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftGraceMinutes: shift.graceMinutes,
        shiftLateHalfDayAfterMinutes: shift.lateHalfDayAfterMinutes,
        shiftRequiredMinutes: policy.requiredMinutes,
        shiftHalfDayMinutes: policy.halfDayMinutes,
        shiftOvertimeAfterMinutes: policy.overtimeAfterMinutes,
        effectiveRequiredMinutes: policy.effectiveRequiredMinutes,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        shiftTimezone: schedule.timeZone,
      })
    : await repository.create({
        employeeId,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        workMode,
        date: attendanceDate,
        shiftDate: schedule.shiftDate,
        shiftId: shift._id || undefined,
        shiftName: shift.name,
        employeeDepartment: employee.department,
        shiftType: shift.shiftType || 'fixed',
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftGraceMinutes: shift.graceMinutes,
        shiftLateHalfDayAfterMinutes: shift.lateHalfDayAfterMinutes,
        shiftRequiredMinutes: policy.requiredMinutes,
        shiftHalfDayMinutes: policy.halfDayMinutes,
        shiftOvertimeAfterMinutes: policy.overtimeAfterMinutes,
        effectiveRequiredMinutes: policy.effectiveRequiredMinutes,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        shiftTimezone: schedule.timeZone,
        ...(closure && { closureId: closure._id, closureType: closure.eventType, attendanceAdjustmentReason: closure.title }),
        signInTime: now,
        status,
        lateMinutes,
        method,
        notes,
        companyId: actor.companyId,
        branchId: actor.branchId,
      });

  // Update employee's lateCount if late
  if (attendanceExempt) {
    await Employee.updateOne({ _id: employeeId }, { $set: { lateCount: 0 } });
  } else if (lateMinutes > 0) {
    await Employee.findByIdAndUpdate(employeeId, { $inc: { lateCount: 1 } });
    // Every complete group of three is only made available for an optional
    // employee leave request. Attendance never deducts leave or salary itself.
    const emp = await Employee.findById(employeeId);
    if (emp && emp.lateCount % 3 === 0) {
      await repository.updateById(record._id, {
        notes: `${notes || ''} [3 lates available for optional leave request]`.trim(),
      });
    }
  }

  return record;
}

// -------------------------------------------------------------------------
// Sign Out
// -------------------------------------------------------------------------
function isRecoveredMissedPunchPenalty(record, recovered = {}) {
  if (!record?.lateCountAppliedAt) return false;
  if (record.missedPunchType === 'sign_out') return Boolean(recovered.signOutTime);
  if (record.missedPunchType === 'sign_in') return Boolean(recovered.signInTime);
  return false;
}

async function clearRecoveredMissedPunchPenalty(record, recovered = {}) {
  if (!isRecoveredMissedPunchPenalty(record, recovered)) return false;
  await repository.updateById(record._id, {
    $unset: { missedPunchType: '', lateCountAppliedAt: '' },
  });
  await Employee.updateOne(
    { _id: record.employeeId?._id || record.employeeId, lateCount: { $gt: 0 } },
    { $inc: { lateCount: -1 } },
  );
  return true;
}

async function signOut({ employeeId, notes, punchTime, recordId }, actor) {
  const record = recordId ? await repository.findById(recordId) : await repository.findOpenByEmployee(employeeId);
  if (!record) throw createHttpError(400, 'No open shift sign-in record was found.');
  if (record.signOutTime) throw createHttpError(409, 'You have already signed out today.');

  const now = punchTime ? new Date(punchTime) : new Date();
  if (now <= new Date(record.signInTime)) {
    throw createHttpError(422, 'Sign-out time must be after sign-in time.');
  }
  const attendanceExempt = actor.role === 'super_admin';
  // Use the policy snapshot captured at sign-in. Editing an assigned shift
  // while somebody is clocked in must not change that open attendance day.
  const shift = {
    shiftType: record.shiftType || 'fixed',
    startTime: record.shiftStartTime,
    endTime: record.shiftEndTime,
    requiredMinutes: record.shiftRequiredMinutes || 480,
    halfDayMinutes: record.shiftHalfDayMinutes,
    overtimeAfterMinutes: record.shiftOvertimeAfterMinutes,
  };
  const schedule = {
    shiftDate: record.shiftDate,
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
    timeZone: record.shiftTimezone || 'Asia/Karachi',
  };
  const closureSubject = {
    department: record.employeeDepartment,
    shiftId: record.shiftId,
  };
  const closure = !attendanceExempt && record.shiftDate
    ? await findClosure(closureSubject, actor.companyId, record.shiftDate)
    : null;
  const policy = effectivePolicy(closure, shift, schedule);
  const isFlexible = (record.shiftType || shift.shiftType) === 'flexible';
  const earlyLeaveMinutes = attendanceExempt || isFlexible
    ? 0
    : calcEarlyLeaveMinutes(now, { scheduledEnd: policy.effectiveEnd });
  const totalHours = calcTotalHours(record.signInTime, now);
  const clockMinutes = Math.max(0, Math.round((now - new Date(record.signInTime)) / 60000));
  const workedMinutes = clockMinutes;
  const overtimeMinutes = attendanceExempt ? 0 : Math.max(0, workedMinutes - policy.overtimeAfterMinutes);
  const fullDayClosure = closure?.eventType === 'full_day' || (closure && !closure.eventType);
  const status = attendanceExempt
    ? 'present'
    : saturdayStatus({
        shiftDate: record.shiftDate,
        hasSignIn: true,
        isFullDayClosure: fullDayClosure,
      }) || completedFixedShiftStatus(record, now, policy.effectiveEnd, policy.effectiveStart) || attendanceStatus(
        record.status,
        workedMinutes,
        policy.effectiveRequiredMinutes,
        policy.effectiveHalfDayMinutes,
        fullDayClosure,
        completionToleranceMinutes(record, policy.effectiveRequiredMinutes),
      );

  const updated = await repository.updateById(record._id, {
    signOutTime: now,
    earlyLeaveMinutes,
    totalHours,
    workedMinutes,
    overtimeMinutes,
    status,
    autoClosedAt: null,
    missedPunchType: null,
    effectiveRequiredMinutes: policy.effectiveRequiredMinutes,
    ...(closure && {
      closureId: closure._id,
      closureType: closure.eventType || 'full_day',
      attendanceAdjustmentReason: `${closure.title}${closure.isPaid === false ? ' (unpaid)' : ' (paid)'}`,
    }),
    ...(notes && { notes }),
  });

  const penaltyCleared = await clearRecoveredMissedPunchPenalty(record, { signOutTime: now });
  return penaltyCleared ? repository.findById(record._id) : updated;
}

function classifyBiometricPunch({ record, punchTime, schedule, shift }) {
  if (!record?.signInTime) return 'sign_in';

  const punchAt = new Date(punchTime);
  const signInAt = new Date(record.signInTime);
  if (punchAt <= signInAt) return 'stale_punch_ignored';
  if (record.signOutTime) return 'extra_punch_ignored';

  const shiftType = record.shiftType || shift?.shiftType || 'fixed';
  const scheduledStart = new Date(record.scheduledStart || schedule.scheduledStart);
  const scheduledEnd = new Date(record.scheduledEnd || schedule.scheduledEnd);
  const requiredMinutes = Number(
    record.effectiveRequiredMinutes
      || record.shiftRequiredMinutes
      || shift?.requiredMinutes
      || 480,
  );

  // A second entry-area scan is not a checkout. Fixed shifts enter their
  // checkout zone halfway through the scheduled duty; flexible shifts do so
  // after half of their required duration has elapsed from the first punch.
  const checkoutBoundary = shiftType === 'flexible'
    ? new Date(signInAt.getTime() + Math.max(30, requiredMinutes / 2) * 60000)
    : new Date(scheduledStart.getTime() + ((scheduledEnd - scheduledStart) / 2));

  return punchAt < checkoutBoundary ? 'duplicate_sign_in_ignored' : 'sign_out';
}

async function ingestBiometricPunch({ employee, punchTime, punchKey, deviceId, deviceUserId }) {
  const actor = {
    id: employee._id,
    role: employee.role,
    companyId: employee.companyId,
    branchId: employee.branchId,
  };
  const pendingCheckout = await repository.findCheckoutCandidate(employee._id, punchTime);
  const context = pendingCheckout
    ? {
        shift: {
          shiftType: pendingCheckout.shiftType,
          requiredMinutes: pendingCheckout.shiftRequiredMinutes,
        },
        schedule: {
          shiftDate: pendingCheckout.shiftDate,
          scheduledStart: pendingCheckout.scheduledStart,
          scheduledEnd: pendingCheckout.scheduledEnd,
        },
      }
    : await resolveShiftContext(employee._id, employee.companyId, new Date(punchTime));
  const { shift, schedule } = context;
  const existing = pendingCheckout
    || await repository.findByEmployeeAndShiftDate(employee._id, schedule.shiftDate);
  let record;
  const action = classifyBiometricPunch({ record: existing, punchTime, schedule, shift });

  if (action === 'sign_in') {
    record = await signIn({
      employeeId: employee._id,
      method: 'biometric',
      punchTime,
      notes: `Biometric sign-in from ${deviceId}.`,
      allowOfficeAttendance: true,
    }, actor);
  } else if (action === 'sign_out') {
    record = await signOut({
      employeeId: employee._id,
      punchTime,
      recordId: existing._id,
      notes: `Biometric sign-out from ${deviceId}.`,
    }, actor);
  } else {
    record = await repository.updateById(existing._id, {
      $addToSet: { biometricPunchKeys: punchKey },
    });
    return { record, action };
  }

  record = await repository.updateById(record._id, {
    $set: {
      biometricDeviceId: deviceId,
      biometricDeviceUserId: String(deviceUserId),
    },
    $addToSet: { biometricPunchKeys: punchKey },
  });
  return { record, action };
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

function attendanceStatus(
  currentStatus,
  workedMinutes,
  requiredMinutes,
  halfDayMinutes,
  isFullDayClosure = false,
  completionTolerance = 0,
) {
  if (isFullDayClosure) return 'holiday';
  // A fixed-shift employee who crossed the arrival half-day boundary remains
  // half-day even when they stay late enough to complete the raw hours.
  if (currentStatus === 'half_day') return 'half_day';
  if (workedMinutes >= Math.max(0, requiredMinutes - completionTolerance)) {
    return currentStatus === 'late' ? 'late' : 'present';
  }
  if (workedMinutes >= halfDayMinutes) return 'half_day';
  return 'absent';
}

function completedFixedShiftStatus(record, signOutTime, effectiveEnd, effectiveStart = record.scheduledStart) {
  if ((record.shiftType || 'fixed') === 'flexible') return null;
  if (!record.signInTime || !signOutTime || !effectiveEnd) return null;
  if (new Date(signOutTime) < new Date(effectiveEnd)) return null;
  if (effectiveStart) {
    return calculateArrivalStatus(
      new Date(record.signInTime),
      { scheduledStart: new Date(effectiveStart) },
      {
        shiftType: 'fixed',
        graceMinutes: Number(record.shiftGraceMinutes || 0),
        lateHalfDayAfterMinutes: Number(record.shiftLateHalfDayAfterMinutes || 0),
      },
    ).status;
  }
  return ['present', 'late', 'half_day'].includes(record.status) ? record.status : null;
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
  const assignedShift = employee.shiftId || {
    _id: null,
    name: 'General Shift', code: 'GENERAL',
    startTime: settings.timing.officeStart, endTime: settings.timing.officeEnd,
    graceMinutes: 15,
    shiftType: 'fixed',
    lateHalfDayAfterMinutes: 150,
    requiredMinutes: 480,
    halfDayMinutes: 240,
    overtimeAfterMinutes: 480,
    workingDays: [0, 1, 2, 3, 4, 5, 6].filter(day => !settings.timing.weekendDays.includes(day)),
    isActive: true,
  };
  const shift = {
    ...(assignedShift.toObject ? assignedShift.toObject() : assignedShift),
    ...normalizeDurationPolicy({}, assignedShift),
  };
  const timeZone = settings.company?.timezone || 'Asia/Karachi';
  const schedule = shift.shiftType === 'flexible'
    ? buildFlexibleSchedule(now, shift, timeZone)
    : buildShiftSchedule(now, shift, timeZone);
  return { employee, shift, schedule };
}

function recordTiming(record, fallback) {
  if (record.scheduledStart || record.scheduledEnd) return {
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
    graceMinutes: record.shiftGraceMinutes || 0,
  };
  return fallback;
}

async function assertCanViewEmployeeAttendance(actor, employeeId) {
  if (String(employeeId) === String(actor.id)) return;
  if (!['super_admin', 'hr', 'manager', 'floor_head', 'team_lead'].includes(actor.role)) {
    throw createHttpError(403, 'You can only view your own attendance.');
  }
  const employee = await Employee.findById(employeeId).select('companyId role department managerId floorHeadId teamLeadId');
  if (!employee || String(employee.companyId) !== String(actor.companyId)) {
    throw createHttpError(404, 'Employee not found.');
  }
  if (actor.role !== 'super_admin' && employee.role === 'super_admin') {
    throw createHttpError(403, 'Super Admin attendance is not visible to your role.');
  }
  if (actor.role === 'manager' && !await managerCanAccessEmployee(actor, employee)) {
    throw createHttpError(403, 'You can only view attendance for employees reporting to you.');
  }
  if (actor.role === 'floor_head' && String(employee.floorHeadId || '') !== String(actor.id)) {
    throw createHttpError(403, 'You can only view attendance for employees assigned to your floor.');
  }
  if (actor.role === 'team_lead' && String(employee.teamLeadId || '') !== String(actor.id)) {
    throw createHttpError(403, 'You can only view attendance for your team members.');
  }
}

function zonedDateKey(value, timeZone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value)).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zonedTimeKey(value, timeZone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.hour}:${parts.minute}`;
}

function addDateKeyDays(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

async function visibleAttendanceEmployeeIds(actor, includeSelf = true) {
  if (!['super_admin', 'hr', 'manager', 'floor_head', 'team_lead'].includes(actor.role)) {
    return includeSelf ? [actor.id] : [];
  }
  const filter = { companyId: actor.companyId };
  if (actor.role === 'manager') Object.assign(filter, await buildManagerEmployeeScope(actor));
  else if (actor.role === 'floor_head') filter.floorHeadId = actor.id;
  else if (actor.role === 'team_lead') filter.teamLeadId = actor.id;
  else if (actor.role !== 'super_admin') filter.role = { $ne: 'super_admin' };
  const ids = await Employee.find(filter).distinct('_id');
  if (includeSelf && !ids.some((id) => String(id) === String(actor.id))) ids.push(actor.id);
  return ids;
}

async function getAttendanceById(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  await assertCanViewEmployeeAttendance(actor, record.employeeId?._id || record.employeeId);
  return record;
}

// -------------------------------------------------------------------------
// Monthly Summary
// -------------------------------------------------------------------------
async function getMonthlySummary(employeeId, year, month, actor) {
  await assertCanViewEmployeeAttendance(actor, employeeId);

  const records = await repository.getMonthlySummary(employeeId, year, month);
  const summary = { present: 0, absent: 0, late: 0, half_day: 0, incomplete: 0, on_leave: 0, holiday: 0 };
  records.forEach((r) => { if (summary[r.status] !== undefined) summary[r.status]++; });
  return { records, summary };
}

// -------------------------------------------------------------------------
// List (Admin/HR view with filters)
// -------------------------------------------------------------------------
async function listAttendances(query, actor) {
  const {
    page = 1, limit = 30, sort = '-date',
    employeeId, status, workMode, dateFrom, dateTo, month, year,
  } = query;

  const filter = { companyId: actor.companyId };

  // Users without HR/team authority only see their own records.
  if (!['hr', 'super_admin', 'manager', 'floor_head', 'team_lead'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    await assertCanViewEmployeeAttendance(actor, employeeId);
    filter.employeeId = employeeId;
  } else {
    filter.employeeId = { $in: await visibleAttendanceEmployeeIds(actor) };
  }

  if (status) filter.status = status;
  Object.assign(filter, buildWorkModeFilter(workMode));

  if (month && year) {
    filter.date = {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0, 23, 59, 59, 999),
    };
  } else if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) {
      filter.date.$gte = new Date(dateFrom);
      filter.date.$gte.setUTCHours(0, 0, 0, 0);
    }
    if (dateTo) {
      filter.date.$lte = new Date(dateTo);
      filter.date.$lte.setUTCHours(23, 59, 59, 999);
    }
  }

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 2000), sort });
}

// -------------------------------------------------------------------------
// Manual attendance correction (HR/Admin)
// -------------------------------------------------------------------------
async function manualCorrection(id, payload, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Attendance record not found.');
  await assertCanViewEmployeeAttendance(actor, record.employeeId?._id || record.employeeId);

  const { signInTime, signOutTime, status, notes } = payload;
  const settings = await settingsService.getPolicy(record.companyId);
  const update = { notes };
  const correctedSignIn = signInTime ? new Date(signInTime) : record.signInTime;
  const correctedSignOut = signOutTime ? new Date(signOutTime) : record.signOutTime;
  const timeZone = record.shiftTimezone || settings.company?.timezone || 'Asia/Karachi';

  if (signInTime) {
    const fixedSignInDate = record.shiftDate || zonedDateKey(
      record.scheduledStart || record.signInTime || record.date, timeZone
    );
    if (zonedDateKey(correctedSignIn, timeZone) !== fixedSignInDate) {
      throw createHttpError(422, `Sign-in date is fixed to ${fixedSignInDate}; only the time can be corrected.`);
    }
  }
  if (signOutTime) {
    const fixedWorkDate = record.shiftDate || zonedDateKey(
      record.scheduledStart || record.signInTime || record.date, timeZone
    );
    const scheduledOvernight = record.scheduledStart && record.scheduledEnd
      && zonedDateKey(record.scheduledEnd, timeZone) !== zonedDateKey(record.scheduledStart, timeZone);
    const correctedClockOvernight = correctedSignIn && correctedSignOut
      && zonedTimeKey(correctedSignOut, timeZone) <= zonedTimeKey(correctedSignIn, timeZone);
    const overnight = (record.shiftStartTime && record.shiftEndTime
      && record.shiftEndTime <= record.shiftStartTime)
      || scheduledOvernight
      || correctedClockOvernight;
    const fixedSignOutDate = record.shiftType === 'flexible'
      ? zonedDateKey(record.signOutTime || record.scheduledEnd || correctedSignOut, timeZone)
      : addDateKeyDays(fixedWorkDate, overnight ? 1 : 0);
    if (zonedDateKey(correctedSignOut, timeZone) !== fixedSignOutDate) {
      throw createHttpError(422, `Sign-out date is fixed to ${fixedSignOutDate}; only the time can be corrected.`);
    }
  }

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
    Object.assign(update, correctedWorkMetrics(
      record,
      correctedSignIn,
      correctedSignOut,
      update.lateMinutes ?? Number(record.lateMinutes || 0),
    ));
    update.autoClosedAt = null;
  }
  if (status) update.status = status;
  if (isSaturdayShiftDate(record.shiftDate) && correctedSignIn) {
    update.status = 'present';
    update.lateMinutes = 0;
  }

  const updated = await repository.updateById(id, update);
  const penaltyCleared = await clearRecoveredMissedPunchPenalty(record, {
    signInTime: signInTime ? correctedSignIn : null,
    signOutTime: signOutTime ? correctedSignOut : null,
  });
  return penaltyCleared ? repository.findById(id) : updated;
}

// -------------------------------------------------------------------------
// Regularization request (Employee)
// -------------------------------------------------------------------------
async function resolveRegularizationApprover(employee, companyId) {
  if (employee.teamLeadId) return employee.teamLeadId;
  if (employee.floorHeadId) return employee.floorHeadId;
  if (employee.managerId) return employee.managerId;

  const fallback = await Employee.findOne({
    companyId,
    role: { $in: ['hr', 'super_admin'] },
    status: 'active',
  }).select('_id');
  return fallback?._id;
}

async function getRangeSummary(employeeId, dateFrom, dateTo, actor, workMode) {
  await assertCanViewEmployeeAttendance(actor, employeeId);

  const records = await repository.getRangeSummary(
    employeeId,
    dateFrom,
    dateTo,
    buildWorkModeFilter(workMode),
  );
  const summary = {
    totalRecords: records.length,
    present: 0, late: 0, absent: 0, half_day: 0, incomplete: 0, on_leave: 0, holiday: 0, weekend: 0,
    workedHours: 0, overtimeHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0,
    attendanceRate: 0, averageHours: 0,
  };
  const trendMap = new Map();

  records.forEach((record) => {
    if (Object.prototype.hasOwnProperty.call(summary, record.status)) summary[record.status] += 1;
    summary.workedHours += Number(record.totalHours || (record.workedMinutes || 0) / 60);
    summary.overtimeHours += Number(record.overtimeMinutes || 0) / 60;
    summary.lateMinutes += Number(record.lateMinutes || 0);
    summary.earlyLeaveMinutes += Number(record.earlyLeaveMinutes || 0);

    const date = new Date(record.date);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!trendMap.has(key)) trendMap.set(key, {
      month: key, present: 0, late: 0, absent: 0, half_day: 0, incomplete: 0, on_leave: 0, workedHours: 0,
    });
    const row = trendMap.get(key);
    if (Object.prototype.hasOwnProperty.call(row, record.status)) row[record.status] += 1;
    row.workedHours += Number(record.totalHours || (record.workedMinutes || 0) / 60);
  });

  const scheduledDays = summary.present + summary.late + summary.absent + summary.half_day + summary.incomplete + summary.on_leave;
  const attendedDays = summary.present + summary.late + (summary.half_day * 0.5);
  const daysWithHours = records.filter((record) => Number(record.totalHours || record.workedMinutes) > 0).length;
  summary.attendanceRate = scheduledDays ? Number(((attendedDays / scheduledDays) * 100).toFixed(1)) : 0;
  summary.workedHours = Number(summary.workedHours.toFixed(2));
  summary.overtimeHours = Number(summary.overtimeHours.toFixed(2));
  summary.averageHours = daysWithHours ? Number((summary.workedHours / daysWithHours).toFixed(2)) : 0;

  const trend = Array.from(trendMap.values()).map((row) => ({
    ...row,
    workedHours: Number(row.workedHours.toFixed(2)),
  }));
  return { summary, trend, records };
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
  if (requestType === 'late_waiver' && record.lateMinutes <= 0 && record.status !== 'late') {
    throw createHttpError(422, 'A late waiver can only be requested for a late attendance record.');
  }
  if (requestType === 'time_correction') {
    const settings = await settingsService.getPolicy(record.companyId);
    const timeZone = record.shiftTimezone || settings.company?.timezone || 'Asia/Karachi';
    const fixedWorkDate = record.shiftDate || zonedDateKey(
      record.scheduledStart || record.signInTime || record.date, timeZone
    );
    const requestedIn = requestedSignInTime ? new Date(requestedSignInTime) : null;
    const requestedOut = requestedSignOutTime ? new Date(requestedSignOutTime) : null;
    const scheduledOvernight = record.scheduledStart && record.scheduledEnd
      && zonedDateKey(record.scheduledEnd, timeZone) !== zonedDateKey(record.scheduledStart, timeZone);
    const requestedClockOvernight = requestedIn && requestedOut
      && zonedTimeKey(requestedOut, timeZone) <= zonedTimeKey(requestedIn, timeZone);
    const overnight = (record.shiftStartTime && record.shiftEndTime
      && record.shiftEndTime <= record.shiftStartTime)
      || scheduledOvernight
      || requestedClockOvernight;
    const fixedSignOutDate = record.shiftType === 'flexible'
      ? zonedDateKey(record.signOutTime || record.scheduledEnd || requestedOut, timeZone)
      : addDateKeyDays(fixedWorkDate, overnight ? 1 : 0);

    if (requestedIn && zonedDateKey(requestedIn, timeZone) !== fixedWorkDate) {
      throw createHttpError(422, `Requested sign-in date is fixed to ${fixedWorkDate}; only the time can be changed.`);
    }
    if (requestedOut && zonedDateKey(requestedOut, timeZone) !== fixedSignOutDate) {
      throw createHttpError(422, `Requested sign-out date is fixed to ${fixedSignOutDate}; only the time can be changed.`);
    }
  }

  const employee = await Employee.findById(actor.id).select('managerId floorHeadId teamLeadId companyId fullName');
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
  await assertCanViewEmployeeAttendance(actor, record.employeeId?._id || record.employeeId);
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
  let recoveredPunches = {};
  let waivedAppliedPenalty = false;

  if (action === 'approve') {
    if (record.regularization.requestType === 'late_waiver') {
      update.lateMinutes = 0;
      if (record.status === 'late') update.status = 'present';
      update.notes = `${record.notes || ''} [Late waived by ${actor.fullName || actor.email}]`.trim();
      await Employee.updateOne(
        { _id: record.employeeId._id || record.employeeId, lateCount: { $gt: 0 } },
        { $inc: { lateCount: -1 } },
      );
      waivedAppliedPenalty = Boolean(record.lateCountAppliedAt);
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
        Object.assign(update, correctedWorkMetrics(
          record,
          correctedSignIn,
          correctedSignOut,
          update.lateMinutes ?? Number(record.lateMinutes || 0),
        ));
        update.autoClosedAt = null;
      }
      recoveredPunches = {
        signInTime: record.regularization.requestedSignInTime ? correctedSignIn : null,
        signOutTime: record.regularization.requestedSignOutTime ? correctedSignOut : null,
      };
      if (isSaturdayShiftDate(record.shiftDate) && correctedSignIn) {
        update.status = 'present';
        update.lateMinutes = 0;
      }
    }
  }

  await repository.updateById(id, update);
  if (waivedAppliedPenalty) {
    await repository.updateById(id, {
      $unset: { missedPunchType: '', lateCountAppliedAt: '' },
    });
  } else if (action === 'approve') {
    await clearRecoveredMissedPunchPenalty(record, recoveredPunches);
  }

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
  const filter = { companyId: actor.companyId };
  if (actor.role !== 'super_admin') {
    filter.employeeId = { $in: await visibleAttendanceEmployeeIds(actor, false) };
  }
  return repository.getPendingRegularizations(filter);
}

async function applyClosureToAttendance(closure) {
  const employeeFilter = { companyId: closure.companyId, status: 'active' };
  if (closure.affectedScope === 'department') employeeFilter.department = closure.affectedDepartment;
  if (closure.affectedScope === 'shift') employeeFilter.shiftId = closure.affectedShiftId;
  const [employees, settings] = await Promise.all([
    Employee.find(employeeFilter).populate('shiftId'),
    settingsService.getPolicy(closure.companyId),
  ]);
  const date = new Date(closure.date);
  const shiftDate = date.toISOString().slice(0, 10);
  let adjusted = 0;

  for (const employee of employees) {
    if (!appliesToEmployee(closure, employee)) continue;
    const shift = employee.shiftId || {
      name: 'General Shift', code: 'GENERAL',
      startTime: settings.timing.officeStart, endTime: settings.timing.officeEnd,
      graceMinutes: settings.timing.graceMinutes, requiredMinutes: 480,
      halfDayMinutes: 240, overtimeAfterMinutes: 480,
      workingDays: [0, 1, 2, 3, 4, 5, 6].filter(day => !settings.timing.weekendDays.includes(day)),
    };
    const schedule = buildShiftSchedule(new Date(`${shiftDate}T12:00:00.000Z`), shift, settings.company?.timezone || 'Asia/Karachi');
    if (!shift.workingDays.includes(schedule.dayOfWeek)) continue;
    const policy = effectivePolicy(closure, shift, schedule);
    const attendanceDate = new Date(`${schedule.shiftDate}T12:00:00.000Z`);
    const record = await repository.findByEmployeeAndShiftDate(employee._id, schedule.shiftDate)
      || await repository.findByEmployeeAndDate(employee._id, attendanceDate);
    const common = {
      closureId: closure._id,
      closureType: closure.eventType || 'full_day',
      attendanceAdjustmentReason: `${closure.title}${closure.isPaid === false ? ' (unpaid)' : ' (paid)'}`,
      effectiveRequiredMinutes: policy.effectiveRequiredMinutes,
      earlyLeaveMinutes: 0,
    };

    if (closure.eventType === 'full_day' || !closure.eventType) {
      if (record) {
        await repository.updateById(record._id, { ...common, shiftDate: schedule.shiftDate, status: 'holiday' });
        adjusted += 1;
        continue;
      }
      await repository.upsertByEmployeeShiftDate(employee._id, schedule.shiftDate, {
        $set: { ...common, status: 'holiday' },
        $setOnInsert: {
          employeeId: employee._id, employeeName: employee.fullName, employeeCode: employee.employeeCode,
          companyId: employee.companyId, branchId: employee.branchId,
          date: attendanceDate, shiftDate: schedule.shiftDate, shiftId: shift._id,
          shiftName: shift.name, shiftStartTime: shift.startTime, shiftEndTime: shift.endTime,
          shiftGraceMinutes: shift.graceMinutes, shiftRequiredMinutes: policy.requiredMinutes,
          shiftHalfDayMinutes: policy.halfDayMinutes,
          shiftOvertimeAfterMinutes: policy.overtimeAfterMinutes,
          scheduledStart: schedule.scheduledStart, scheduledEnd: schedule.scheduledEnd,
          shiftTimezone: schedule.timeZone, method: 'manual',
        },
      });
      adjusted += 1;
      continue;
    }

    if (!record) continue;
    const update = { ...common };
    if (record.signInTime && record.signOutTime) {
      const clockMinutes = Math.max(0, Math.round((new Date(record.signOutTime) - new Date(record.signInTime)) / 60000));
      const workedMinutes = clockMinutes;
      update.workedMinutes = workedMinutes;
      update.overtimeMinutes = Math.max(0, workedMinutes - policy.overtimeAfterMinutes);
      update.status = attendanceStatus(
        record.status,
        workedMinutes,
        policy.effectiveRequiredMinutes,
        policy.effectiveHalfDayMinutes,
        false,
        completionToleranceMinutes(record, policy.effectiveRequiredMinutes),
      );
      update.earlyLeaveMinutes = calcEarlyLeaveMinutes(record.signOutTime, { scheduledEnd: policy.effectiveEnd });
    }
    await repository.updateById(record._id, update);
    adjusted += 1;
  }
  return adjusted;
}

async function removeClosureFromAttendance(closure) {
  const records = await repository.findByClosure(closure._id);
  let adjusted = 0;
  for (const record of records) {
    if (!record.signInTime) {
      await repository.deleteById(record._id);
      adjusted += 1;
      continue;
    }
    const shift = {
      startTime: record.shiftStartTime,
      endTime: record.shiftEndTime,
      requiredMinutes: record.shiftRequiredMinutes || 480,
      halfDayMinutes: record.shiftHalfDayMinutes,
      overtimeAfterMinutes: record.shiftOvertimeAfterMinutes,
    };
    const schedule = {
      shiftDate: record.shiftDate,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      timeZone: record.shiftTimezone || 'Asia/Karachi',
    };
    const policy = effectivePolicy(null, shift, schedule);
    const update = {
      $unset: { closureId: '', closureType: '', attendanceAdjustmentReason: '' },
      $set: { effectiveRequiredMinutes: policy.effectiveRequiredMinutes },
    };
    if (record.signOutTime) {
      const clockMinutes = Math.max(0, Math.round((new Date(record.signOutTime) - new Date(record.signInTime)) / 60000));
      const workedMinutes = clockMinutes;
      update.$set.workedMinutes = workedMinutes;
      update.$set.overtimeMinutes = Math.max(0, workedMinutes - policy.overtimeAfterMinutes);
      update.$set.earlyLeaveMinutes = calcEarlyLeaveMinutes(record.signOutTime, { scheduledEnd: policy.effectiveEnd });
      const lateMinutes = calcLateMinutes(record.signInTime, { scheduledStart: policy.effectiveStart, graceMinutes: record.shiftGraceMinutes || 0 });
      update.$set.lateMinutes = lateMinutes;
      update.$set.status = attendanceStatus(
        lateMinutes > 0 ? 'late' : 'present',
        workedMinutes,
        policy.effectiveRequiredMinutes,
        policy.effectiveHalfDayMinutes,
        false,
        completionToleranceMinutes(record, policy.effectiveRequiredMinutes),
      );
    }
    await repository.updateById(record._id, update);
    adjusted += 1;
  }
  return adjusted;
}

module.exports = {
  signIn,
  signOut,
  getTodayAttendance,
  getAttendanceById,
  getMonthlySummary,
  getRangeSummary,
  listAttendances,
  manualCorrection,
  requestRegularization,
  reviewRegularization,
  getPendingRegularizations,
  applyClosureToAttendance,
  removeClosureFromAttendance,
  correctedWorkMetrics,
  completionToleranceMinutes,
  completedFixedShiftStatus,
  classifyBiometricPunch,
  isRecoveredMissedPunchPenalty,
  ingestBiometricPunch,
};
