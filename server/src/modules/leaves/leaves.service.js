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
const repository = require('./leaves.repository');
const Employee = require('../employees/employees.model');
const notificationService = require('../notifications/notifications.service');
const settingsService = require('../companySettings/companySettings.service');
const logger = require('../../utils/logger');

// Map leave types to Employee.leaveBalance field keys
const LEAVE_BALANCE_KEYS = {
  paid: 'paid', casual: 'casual', sick: 'sick', annual: 'annual',
};

function calcWorkingDays(startDate, endDate, weekendDays = [0, 6]) {
  let count = 0;
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const dow = cur.getDay();
    if (!weekendDays.includes(dow)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
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
  const { leaveType, startDate, endDate, reason, emergencyContact } = payload;

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
  const overlapping = await repository.countActiveLeaves(actor.id, start, end);
  if (overlapping > 0) throw createHttpError(409, 'You already have a leave request overlapping these dates.');

  const totalDays = calcWorkingDays(start, end, settings.timing.weekendDays);

  // Check balance for paid leave types
  if (LEAVE_BALANCE_KEYS[leaveType]) {
    const emp = await Employee.findById(actor.id);
    if (emp?.leaveBalance?.[leaveType]) {
      const bal = emp.leaveBalance[leaveType];
      const remaining = (bal.available || 0) - (bal.used || 0);
      if (totalDays > remaining) {
        throw createHttpError(400, `Insufficient ${leaveType} leave balance. Available: ${remaining} days.`);
      }
    }
  }

  const leave = await repository.create({
    employeeId: actor.id,
    leaveType,
    startDate: start,
    endDate: end,
    totalDays,
    reason: reason || '',
    emergencyContact: emergencyContact || '',
    status: 'pending',
    currentStage: 1,
    approvalChain: buildApprovalChain(),
    companyId: actor.companyId,
    branchId: actor.branchId,
  });

  await notifyStageApprovers(leave, 1);

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
    if (step.stage === actorStage) {
      return { ...step, status: 'approved', approvedBy: actor.id, actionAt: new Date(), remarks: remarks || '' };
    }
    return step;
  });

  const isLastStage = actorStage === 3;
  const nextStage = actorStage + 1;

  const update = {
    approvalChain: chain,
    currentStage: isLastStage ? actorStage : nextStage,
    status: isLastStage ? 'approved' : 'pending',
  };

  // Deduct leave balance on final approval
  if (isLastStage && LEAVE_BALANCE_KEYS[leave.leaveType]) {
    const key = LEAVE_BALANCE_KEYS[leave.leaveType];
    await Employee.findByIdAndUpdate(leave.employeeId, {
      $inc: { [`leaveBalance.${key}.used`]: leave.totalDays },
    });
  }

  const updated = await repository.updateById(id, update);
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
    if (step.stage === actorStage) {
      return { ...step, status: 'rejected', approvedBy: actor.id, actionAt: new Date(), remarks: remarks || '' };
    }
    return step;
  });

  const updated = await repository.updateById(id, { approvalChain: chain, status: 'rejected' });
  await notifyEmployee(leave, {
    type: 'leave_rejected',
    title: 'Leave rejected',
    message: `Your ${leave.leaveType} leave request was rejected.`,
    metadata: { leaveId: leave._id, remarks: remarks || '' },
    dedupeKey: `leave-rejected:${leave._id}`,
  });
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
    filter.startDate = { $gte: start, $lt: end };
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

module.exports = { applyLeave, approveLeave, rejectLeave, cancelLeave, listLeaves, getLeaveById, getPendingApprovals };
