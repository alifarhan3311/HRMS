/**
 * modules/leaves/leaves.service.js
 * Leave management with multi-stage approval:
 *  Employee → Team Lead/Manager (Stage 1) → HR (Stage 2) → Admin (Stage 3/Final)
 *
 * Leave balance is deducted from Employee when fully approved.
 * Employees may cancel only while a request is pending. Once approved,
 * the decision is final and the leave balance/attendance record is locked.
 */
const createHttpError = require('http-errors');
const mongoose = require('mongoose');
const Attendance = require('../attendance/attendance.model');
const repository = require('./leaves.repository');
const LeaveRequest = require('./leaves.model');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');
const settingsService = require('../companySettings/companySettings.service');
const logger = require('../../utils/logger');
const { emitToCompany } = require('../../config/socket');

function leaveEligibilityDate(joiningDate) {
  const joined = new Date(joiningDate);
  const targetMonthIndex = joined.getUTCMonth() + 3;
  const targetYear = joined.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(joined.getUTCDate(), lastDay)));
}

function emitLeaveUpdate(companyId, action, leave) {
  emitToCompany(companyId, 'leave:updated', {
    id: String(leave._id),
    action,
    status: leave.status,
    currentStage: leave.currentStage,
    updatedAt: leave.updatedAt || new Date(),
  });
}

// Map leave types to Employee.leaveBalance field keys
const LEAVE_BALANCE_KEYS = {
  paid: 'paid', casual: 'casual', sick: 'sick', annual: 'annual',
};

function zonedDateTimeParts(value, timeZone = 'Asia/Karachi') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
    return parts;
  }, {});
}

function clockMinutes(parts) {
  return (Number(parts.hour) * 60) + Number(parts.minute);
}

function shiftClockMinutes(value) {
  const [hour, minute] = String(value || '00:00').split(':').map(Number);
  return (hour * 60) + minute;
}

function previousCalendarDate(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function calculateLeaveDutyDates(startDate, endDate, weekendDays = [0, 6], shift = null, timeZone = 'Asia/Karachi') {
  const startParts = zonedDateTimeParts(startDate, timeZone);
  let endParts = zonedDateTimeParts(endDate, timeZone);
  const shiftStart = shiftClockMinutes(shift?.startTime);
  const shiftEnd = shiftClockMinutes(shift?.endTime);
  const isOvernightShift = shift?.shiftType !== 'flexible' && shiftEnd <= shiftStart;

  // An overnight shift belongs to the date on which it starts. Therefore an
  // interval such as 22 Jul 22:00 -> 23 Jul 04:00 consumes one leave day.
  const sameSubmittedClock = clockMinutes(startParts) === clockMinutes(endParts);
  const explicitOvernightTimes = clockMinutes(startParts) >= shiftStart
    && clockMinutes(endParts) <= shiftEnd;
  if (isOvernightShift && (sameSubmittedClock || explicitOvernightTimes)) {
    endParts = previousCalendarDate(endParts);
  }

  const dutyDates = [];
  const cur = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day, 12));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day, 12));
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (!weekendDays.includes(dow)) dutyDates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (!dutyDates.length) {
    dutyDates.push(`${startParts.year}-${String(startParts.month).padStart(2, '0')}-${String(startParts.day).padStart(2, '0')}`);
  }
  return dutyDates;
}

function calcWorkingDays(startDate, endDate, weekendDays = [0, 6], shift = null, timeZone = 'Asia/Karachi') {
  return calculateLeaveDutyDates(startDate, endDate, weekendDays, shift, timeZone).length;
}

function buildApprovalChain() {
  return [
    { stage: 1, approverRole: 'team_lead/manager', status: 'pending' },
    { stage: 2, approverRole: 'hr', status: 'pending' },
    { stage: 3, approverRole: 'admin', status: 'pending' },
  ];
}

async function visibleLeaveEmployeeIds(actor, includeSelf = true) {
  const filter = { companyId: actor.companyId };
  if (actor.role === 'manager') filter.managerId = actor.id;
  else if (actor.role === 'team_lead') filter.teamLeadId = actor.id;
  else if (actor.role !== 'super_admin') filter.role = { $ne: 'super_admin' };
  const ids = await Employee.find(filter).distinct('_id');
  if (includeSelf && !ids.some((id) => String(id) === String(actor.id))) ids.push(actor.id);
  return ids;
}

async function assertCanViewLeave(actor, employeeId) {
  if (String(employeeId) === String(actor.id)) return;
  const employee = await Employee.findById(employeeId).select('companyId role managerId teamLeadId');
  if (!employee || String(employee.companyId) !== String(actor.companyId)) {
    throw createHttpError(404, 'Leave request not found.');
  }
  if (actor.role !== 'super_admin' && employee.role === 'super_admin') {
    throw createHttpError(403, 'Super Admin leave records are not visible to your role.');
  }
  if (actor.role === 'manager' && String(employee.managerId || '') !== String(actor.id)) {
    throw createHttpError(403, 'You can only view leave records for employees reporting to you.');
  }
  if (actor.role === 'team_lead' && String(employee.teamLeadId || '') !== String(actor.id)) {
    throw createHttpError(403, 'You can only view leave records for your team members.');
  }
  if (!['super_admin', 'admin', 'hr', 'manager', 'team_lead'].includes(actor.role)) {
    throw createHttpError(403, 'You can only view your own leave records.');
  }
}

async function notifyEmployee(leave, notification) {
  try {
    await notificationService.createNotification({
      recipientId: leave.employeeId?._id || leave.employeeId,
      companyId: leave.companyId,
      link: '/leaves',
      ...notification,
    });
  } catch (error) {
    logger.error('[leaves] Notification creation failed', {
      leaveId: leave._id,
      error: error.message,
    });
  }
}

function approvalNotificationPayload(leave, stage, recipientId, employee) {
  const employeeId = leave.employeeId?._id || leave.employeeId;
  const employeeName = employee?.fullName || leave.employeeId?.fullName || 'An employee';
  return {
    recipientId,
    companyId: leave.companyId,
    type: 'leave_approval_required',
    title: 'Leave approval required',
    message: `${employeeName} submitted a ${leave.leaveType} leave request awaiting your approval.`,
    link: '/leaves',
    metadata: { leaveId: leave._id, employeeId, stage },
    dedupeKey: `leave-approval:${leave._id}:stage:${stage}:recipient:${recipientId}`,
  };
}

async function stageApproverIds(leave, stage) {
  const employeeId = leave.employeeId?._id || leave.employeeId;
  const employee = await Employee.findById(employeeId)
    .select('fullName role managerId teamLeadId companyId status')
    .lean();
  if (!employee) return { employee: null, recipientIds: [] };

  let recipientIds = [];
  if (stage === 1) {
    // Employees go to their Team Lead first when one exists. A Team Lead's
    // own request goes to their Manager, never back to themselves.
    const directApprover = employee.role === 'team_lead'
      ? employee.managerId
      : employee.teamLeadId || employee.managerId;
    if (directApprover) recipientIds = [directApprover];
  } else if (stage === 2) {
    recipientIds = await Employee.find({
      companyId: leave.companyId,
      role: 'hr',
      status: 'active',
      _id: { $ne: employeeId },
    }).distinct('_id');
  } else if (stage === 3) {
    recipientIds = await Employee.find({
      companyId: leave.companyId,
      role: { $in: ['admin', 'super_admin'] },
      status: 'active',
      _id: { $ne: employeeId },
    }).distinct('_id');
  }

  return {
    employee,
    recipientIds: [...new Map(recipientIds.map(id => [String(id), id])).values()]
      .filter(id => String(id) !== String(employeeId)),
  };
}

async function notifyStageApprovers(leave, stage, onlyRecipientId = null) {
  try {
    const { employee, recipientIds: resolvedIds } = await stageApproverIds(leave, stage);
    const recipientIds = onlyRecipientId
      ? resolvedIds.filter(id => String(id) === String(onlyRecipientId))
      : resolvedIds;
    const results = await Promise.allSettled(recipientIds.map(recipientId =>
      notificationService.createNotification(
        approvalNotificationPayload(leave, stage, recipientId, employee)
      )
    ));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('[leaves] Approver notification creation failed', {
          leaveId: String(leave._id),
          stage,
          recipientId: String(recipientIds[index]),
          error: result.reason?.message,
        });
      }
    });
  } catch (error) {
    // Notification delivery must never roll back a valid leave application.
    logger.error('[leaves] Could not resolve leave approvers', {
      leaveId: String(leave._id),
      stage,
      error: error.message,
    });
  }
}

// ─── Apply ───────────────────────────────────────────────────────────────────
async function applyLeave(payload, actor) {
  const { leaveType, startDate, endDate, reason, emergencyContact, employeeId, attendanceId } = payload;
  const isHrOverride = Boolean(employeeId) && actor.role === 'hr';
  if (employeeId && !isHrOverride) throw createHttpError(403, 'Only HR can assign leave for another employee.');
  const targetEmployeeId = isHrOverride ? employeeId : actor.id;
  const employee = await Employee.findOne({ _id: targetEmployeeId, companyId: actor.companyId }).populate('shiftId');
  if (!employee) throw createHttpError(404, 'Employee not found.');
  const eligibilityDate = leaveEligibilityDate(employee.joiningDate);
  if (!isHrOverride && new Date() < eligibilityDate) {
    throw createHttpError(403, `Leave is available after completing 3 months of service (${eligibilityDate.toISOString().slice(0, 10)}). Contact HR for an absence exception.`);
  }
  if (isHrOverride && new Date() >= eligibilityDate) {
    throw createHttpError(422, 'HR attendance exception is only for employees who have not completed 3 months.');
  }

  if (leaveType !== 'casual' && !String(reason || '').trim()) {
    throw createHttpError(422, `A reason is required for ${leaveType || 'this'} leave.`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw createHttpError(400, 'End date cannot be before start date.');
  const settings = await settingsService.getPolicy(actor.companyId);
  const enabledTypes = settings.leavePolicy?.enabledTypes || Object.keys(LEAVE_BALANCE_KEYS);
  if (!enabledTypes.includes(leaveType)) {
    throw createHttpError(400, `${leaveType} leave is not enabled for your company.`);
  }

  // Check for overlapping leaves
  let attendanceRecord = null;
  if (isHrOverride) {
    if (!attendanceId || start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10)) {
      throw createHttpError(422, 'HR exception must reference one fixed attendance date.');
    }
    attendanceRecord = await Attendance.findOne({
      _id: attendanceId,
      employeeId: targetEmployeeId,
      companyId: actor.companyId,
      status: { $in: ['absent', 'half_day'] },
    });
    if (!attendanceRecord) throw createHttpError(422, 'HR can only mark leave on this employee’s absent or half-day attendance.');
  }
  const overlapping = await repository.countActiveLeaves(targetEmployeeId, start, end);
  if (overlapping > 0) throw createHttpError(409, 'You already have a leave request overlapping these dates.');

  const assignedShift = employee.shiftId || {
    shiftType: 'fixed',
    startTime: settings.timing.officeStart,
    endTime: settings.timing.officeEnd,
  };
  const dutyDates = calculateLeaveDutyDates(
    start,
    end,
    settings.timing.weekendDays,
    assignedShift,
    settings.company?.timezone || 'Asia/Karachi',
  );
  const totalDays = dutyDates.length;

  // Check balance for paid leave types
  if (LEAVE_BALANCE_KEYS[leaveType]) {
    if (employee.leaveBalance?.[leaveType]) {
      const bal = employee.leaveBalance[leaveType];
      const remaining = (bal.available || 0) - (bal.used || 0);
      if (totalDays > remaining) {
        throw createHttpError(400, `Insufficient ${leaveType} leave balance. Available: ${remaining} days.`);
      }
    }
  }

  const leave = await repository.create({
    employeeId: targetEmployeeId,
    employeeName: employee.fullName,
    employeeCode: employee.employeeCode,
    leaveType,
    startDate: start,
    endDate: end,
    totalDays,
    dutyDates,
    reason: reason || '',
    emergencyContact: emergencyContact || '',
    status: isHrOverride ? 'approved' : 'pending',
    currentStage: isHrOverride ? 3 : 1,
    approvalChain: isHrOverride ? [] : buildApprovalChain(),
    companyId: actor.companyId,
    branchId: actor.branchId,
  });

  if (isHrOverride) {
    if (LEAVE_BALANCE_KEYS[leaveType]) {
      const key = LEAVE_BALANCE_KEYS[leaveType];
      const remaining = Number(employee.leaveBalance[key]?.available || 0) - Number(employee.leaveBalance[key]?.used || 0);
      if (remaining < totalDays) throw createHttpError(409, `Insufficient ${leaveType} leave balance.`);
      employee.leaveBalance[key].used = Number(employee.leaveBalance[key].used || 0) + totalDays;
      await employee.save();
    }
    attendanceRecord.status = 'on_leave';
    attendanceRecord.notes = `${attendanceRecord.notes || ''} [HR leave exception: ${reason || leaveType}]`.trim();
    await attendanceRecord.save();
  } else {
    await notifyStageApprovers(leave, 1);
  }

  emitLeaveUpdate(actor.companyId, 'applied', leave);

  return leave;
}

// ─── Approve ─────────────────────────────────────────────────────────────────
async function approveLeave(id, { remarks }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
  await assertCanViewLeave(actor, leave.employeeId?._id || leave.employeeId);
  if (leave.status !== 'pending') throw createHttpError(400, 'This leave is no longer pending.');

  const ROLE_STAGE_MAP = { team_lead: 1, manager: 1, hr: 2, admin: 3, super_admin: 3 };
  const actorStage = ROLE_STAGE_MAP[actor.role];
  if (!actorStage) throw createHttpError(403, 'Your role cannot approve leave requests.');
  if (actorStage !== leave.currentStage) {
    throw createHttpError(403, `This leave is at stage ${leave.currentStage}. You can only approve at stage ${actorStage}.`);
  }

  // Update chain
  const chain = leave.approvalChain.map((step) => {
    const plainStep = step.toObject ? step.toObject() : step;
    if (step.stage === actorStage) {
      return { ...plainStep, status: 'approved', approvedBy: actor.id, actionAt: new Date(), remarks: remarks || '' };
    }
    return plainStep;
  });

  const isLastStage = actorStage === 3;
  const nextStage = actorStage + 1;

  const update = {
    approvalChain: chain,
    currentStage: isLastStage ? actorStage : nextStage,
    status: isLastStage ? 'approved' : 'pending',
  };

  let updated;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      updated = await LeaveRequest.findOneAndUpdate(
        { _id: id, status: 'pending', currentStage: actorStage },
        { $set: update },
        { new: true, runValidators: true, session },
      );
      if (!updated) {
        throw createHttpError(409, 'This leave stage was already processed by another approver.');
      }

      if (isLastStage && LEAVE_BALANCE_KEYS[leave.leaveType]) {
        const key = LEAVE_BALANCE_KEYS[leave.leaveType];
        const employee = await Employee.findById(leave.employeeId).session(session);
        const balance = employee?.leaveBalance?.[key];
        const remaining = Number(balance?.available || 0) - Number(balance?.used || 0);
        if (!employee || remaining < Number(leave.totalDays)) {
          throw createHttpError(409, `Insufficient ${leave.leaveType} leave balance at final approval.`);
        }
        employee.leaveBalance[key].used = Number(balance.used || 0) + Number(leave.totalDays);
        await employee.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
  updated = await repository.findById(id);
  if (isLastStage) {
    await notifyEmployee(leave, {
      type: 'leave_approved',
      title: 'Leave approved',
      message: `Your ${leave.leaveType} leave request has received final approval.`,
      metadata: { leaveId: leave._id },
      dedupeKey: `leave-approved:${leave._id}`,
    });
  } else {
    await notifyStageApprovers(updated, nextStage);
  }
  emitLeaveUpdate(actor.companyId, 'approved', updated);
  return updated;
}

// ─── Reject ──────────────────────────────────────────────────────────────────
async function rejectLeave(id, { remarks }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
  await assertCanViewLeave(actor, leave.employeeId?._id || leave.employeeId);
  if (leave.status !== 'pending') throw createHttpError(400, 'This leave is no longer pending.');

  const ROLE_STAGE_MAP = { team_lead: 1, manager: 1, hr: 2, admin: 3, super_admin: 3 };
  const actorStage = ROLE_STAGE_MAP[actor.role];
  if (!actorStage) throw createHttpError(403, 'Your role cannot reject leave requests.');
  if (actorStage !== leave.currentStage) {
    throw createHttpError(403, `This leave is at stage ${leave.currentStage}. You can only reject at stage ${actorStage}.`);
  }

  const chain = leave.approvalChain.map((step) => {
    const plainStep = step.toObject ? step.toObject() : step;
    if (step.stage === actorStage) {
      return { ...plainStep, status: 'rejected', approvedBy: actor.id, actionAt: new Date(), remarks: remarks || '' };
    }
    return plainStep;
  });

  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: id, status: 'pending', currentStage: actorStage },
    { $set: { approvalChain: chain, status: 'rejected' } },
    { new: true, runValidators: true },
  ).populate('employeeId', 'fullName employeeCode department');
  if (!updated) throw createHttpError(409, 'This leave stage was already processed by another approver.');
  await notifyEmployee(leave, {
    type: 'leave_rejected',
    title: 'Leave rejected',
    message: `Your ${leave.leaveType} leave request was rejected.`,
    metadata: { leaveId: leave._id, remarks: remarks || '' },
    dedupeKey: `leave-rejected:${leave._id}`,
  });
  emitLeaveUpdate(actor.companyId, 'rejected', updated);
  return updated;
}

// ─── Cancel ──────────────────────────────────────────────────────────────────
async function cancelLeave(id, { reason }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
  await assertCanViewLeave(actor, leave.employeeId?._id || leave.employeeId);
  const isOwner = String(leave.employeeId._id || leave.employeeId) === String(actor.id);
  if (!isOwner && !['admin', 'hr', 'super_admin'].includes(actor.role)) {
    throw createHttpError(403, 'You cannot cancel this leave request.');
  }
  if (leave.status === 'approved') {
    throw createHttpError(409, 'Approved leave cannot be cancelled. Contact HR for a formal attendance correction if required.');
  }
  if (leave.status !== 'pending') {
    throw createHttpError(409, `A ${leave.status} leave request cannot be cancelled.`);
  }

  // Conditional update closes the race where an approver approves the leave
  // between the status check above and this write.
  const updated = await repository.cancelPendingById(id, reason || '');
  if (!updated) {
    throw createHttpError(409, 'This leave is no longer pending and cannot be cancelled.');
  }
  emitLeaveUpdate(actor.companyId, 'cancelled', updated);
  return updated;
}

// ─── List ────────────────────────────────────────────────────────────────────
async function listLeaves(query, actor) {
  const { page = 1, limit = 20, status, leaveType, employeeId, year, month, sort = '-createdAt' } = query;
  const filter = { companyId: actor.companyId };

  if (!['admin', 'hr', 'super_admin', 'manager', 'team_lead'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    await assertCanViewLeave(actor, employeeId);
    filter.employeeId = employeeId;
  } else {
    filter.employeeId = { $in: await visibleLeaveEmployeeIds(actor) };
  }

  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (year) {
    const numericYear = Number(year);
    const numericMonth = month ? Number(month) : null;
    if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2200) {
      throw createHttpError(400, 'Year must be between 2000 and 2200.');
    }
    if (numericMonth !== null && (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12)) {
      throw createHttpError(400, 'Month must be between 1 and 12.');
    }
    const start = numericMonth
      ? new Date(Date.UTC(numericYear, numericMonth - 1, 1))
      : new Date(Date.UTC(numericYear, 0, 1));
    const end = numericMonth
      ? new Date(Date.UTC(numericYear, numericMonth, 1))
      : new Date(Date.UTC(numericYear + 1, 0, 1));
    // Include every leave overlapping the selected period, even when it
    // started in the previous month and continues into this one.
    filter.startDate = { $lt: end };
    filter.endDate = { $gte: start };
  }

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 100), sort });
}

async function getLeaveById(id, actor) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Leave request not found.');
  await assertCanViewLeave(actor, record.employeeId?._id || record.employeeId);
  return record;
}

async function getPendingApprovals(actor) {
  const ROLE_STAGE_MAP = { team_lead: 1, manager: 1, hr: 2, admin: 3, super_admin: 3 };
  const stage = ROLE_STAGE_MAP[actor.role];
  if (!stage) return [];
  const employeeIds = actor.role === 'super_admin'
    ? null
    : await visibleLeaveEmployeeIds(actor, false);
  const records = await repository.getPendingByStage(actor.companyId, stage, employeeIds);
  // Backfill notifications for requests created before staged approver
  // notifications were introduced. The dedupe key makes this idempotent.
  await Promise.allSettled(records.map(record =>
    notifyStageApprovers(record, stage, actor.id)
  ));
  return records;
}

module.exports = {
  calcWorkingDays,
  calculateLeaveDutyDates,
  leaveEligibilityDate,
  applyLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  listLeaves,
  getLeaveById,
  getPendingApprovals,
};
