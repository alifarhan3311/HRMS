/**
 * modules/leaves/leaves.service.js
 * Leave management with multi-stage approval:
 *  Employee → Team Lead/Manager (Stage 1) → HR (Stage 2) → Admin (Stage 3/Final)
 *
 * Leave balance is deducted from Employee when fully approved.
 * Cancellation before approval restores nothing (no deduction yet).
 * Cancellation after approval restores the leave balance.
 */
const createHttpError = require('http-errors');
const repository = require('./leaves.repository');
const Employee = require('../employees/employees.model');

// Map leave types to Employee.leaveBalance field keys
const LEAVE_BALANCE_KEYS = {
  paid: 'paid', casual: 'casual', sick: 'sick', annual: 'annual',
};

function calcWorkingDays(startDate, endDate) {
  let count = 0;
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++; // skip weekends
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

// ─── Apply ───────────────────────────────────────────────────────────────────
async function applyLeave(payload, actor) {
  const { leaveType, startDate, endDate, reason, emergencyContact } = payload;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw createHttpError(400, 'End date cannot be before start date.');

  // Check for overlapping leaves
  const overlapping = await repository.countActiveLeaves(actor.id, start, end);
  if (overlapping > 0) throw createHttpError(409, 'You already have a leave request overlapping these dates.');

  const totalDays = calcWorkingDays(start, end);

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

  return leave;
}

// ─── Approve ─────────────────────────────────────────────────────────────────
async function approveLeave(id, { remarks }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
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
  return updated;
}

// ─── Reject ──────────────────────────────────────────────────────────────────
async function rejectLeave(id, { remarks }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
  if (leave.status !== 'pending') throw createHttpError(400, 'This leave is no longer pending.');

  const ROLE_STAGE_MAP = { team_lead: 1, manager: 1, hr: 2, admin: 3, super_admin: 3 };
  const actorStage = ROLE_STAGE_MAP[actor.role];
  if (!actorStage) throw createHttpError(403, 'Your role cannot reject leave requests.');

  const chain = leave.approvalChain.map((step) => {
    if (step.stage === actorStage) {
      return { ...step, status: 'rejected', approvedBy: actor.id, actionAt: new Date(), remarks: remarks || '' };
    }
    return step;
  });

  const updated = await repository.updateById(id, { approvalChain: chain, status: 'rejected' });
  return updated;
}

// ─── Cancel ──────────────────────────────────────────────────────────────────
async function cancelLeave(id, { reason }, actor) {
  const leave = await repository.findById(id);
  if (!leave) throw createHttpError(404, 'Leave request not found.');
  const isOwner = String(leave.employeeId._id || leave.employeeId) === String(actor.id);
  if (!isOwner && !['admin', 'hr', 'super_admin'].includes(actor.role)) {
    throw createHttpError(403, 'You cannot cancel this leave request.');
  }
  if (leave.status === 'cancelled') throw createHttpError(400, 'Already cancelled.');

  // Restore balance if was approved
  if (leave.status === 'approved' && LEAVE_BALANCE_KEYS[leave.leaveType]) {
    const key = LEAVE_BALANCE_KEYS[leave.leaveType];
    await Employee.findByIdAndUpdate(leave.employeeId, {
      $inc: { [`leaveBalance.${key}.used`]: -leave.totalDays },
    });
  }

  const updated = await repository.updateById(id, {
    status: 'cancelled',
    cancellationReason: reason || '',
  });
  return updated;
}

// ─── List ────────────────────────────────────────────────────────────────────
async function listLeaves(query, actor) {
  const { page = 1, limit = 20, status, leaveType, employeeId, sort = '-createdAt' } = query;
  const filter = { companyId: actor.companyId };

  if (!['admin', 'hr', 'super_admin', 'manager', 'team_lead'].includes(actor.role)) {
    filter.employeeId = actor.id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }

  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;

  return repository.findAll({ filter, page: Number(page), limit: Math.min(Number(limit), 100), sort });
}

async function getLeaveById(id) {
  const record = await repository.findById(id);
  if (!record) throw createHttpError(404, 'Leave request not found.');
  return record;
}

async function getPendingApprovals(actor) {
  const ROLE_STAGE_MAP = { team_lead: 1, manager: 1, hr: 2, admin: 3, super_admin: 3 };
  const stage = ROLE_STAGE_MAP[actor.role];
  if (!stage) return [];
  return repository.getPendingByStage(actor.companyId, stage);
}

module.exports = { applyLeave, approveLeave, rejectLeave, cancelLeave, listLeaves, getLeaveById, getPendingApprovals };
