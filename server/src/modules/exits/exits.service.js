const createHttpError = require('http-errors');
const Exit = require('./exits.model');
const Employee = require('../employees/employees.model');
const { createNotification } = require('../notifications/notifications.service');

const HR_ROLES = ['hr', 'super_admin'];
const CHECKLIST = [
  ['attendance', 'Attendance reviewed'], ['leaves', 'Leave balance reviewed'],
  ['salary', 'Final salary calculated'], ['loans', 'Advance / loan cleared'],
  ['assets', 'Company assets returned'], ['handover', 'Work handover completed'],
  ['exit_interview', 'Exit interview completed'], ['documents', 'Exit documents prepared'],
].map(([key, label]) => ({ key, label }));

const notify = (recipientId, companyId, title, message, id) => createNotification({
  recipientId, companyId, type: 'employee_exit', title, message,
  link: '/exits', metadata: { exitId: id },
  dedupeKey: `exit:${id}:${recipientId}:${title}`,
});

async function hrUsers(companyId) {
  return Employee.find({ companyId, role: { $in: HR_ROLES }, status: 'active' }).select('_id');
}

async function submit(body, actor) {
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId });
  if (!employee || employee.status !== 'active') throw createHttpError(400, 'Only an active employee can resign.');
  const existing = await Exit.exists({ employeeId: employee._id, status: { $in: ['pending_approval', 'hr_review', 'accepted', 'clearance'] } });
  if (existing) throw createHttpError(409, 'You already have an active resignation request.');
  if (new Date(body.proposedLastWorkingDay) < new Date(body.resignationDate)) {
    throw createHttpError(400, 'Proposed last working day cannot be before resignation date.');
  }
  const ids = [employee.teamLeadId, employee.floorHeadId, employee.managerId].filter(Boolean);
  const people = ids.length ? await Employee.find({ _id: { $in: ids }, status: 'active' }).select('_id role') : [];
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const approvals = ids.map((id) => byId.get(String(id))).filter(Boolean)
    .map((p) => ({ approverId: p._id, role: p.role, status: 'pending' }));
  const record = await Exit.create({
    employeeId: employee._id, companyId: employee.companyId,
    resignationDate: body.resignationDate, proposedLastWorkingDay: body.proposedLastWorkingDay,
    reason: body.reason, comments: body.comments, attachmentUrl: body.attachmentUrl,
    approvals, checklist: CHECKLIST, status: approvals.length ? 'pending_approval' : 'hr_review',
  });
  if (approvals[0]) await notify(approvals[0].approverId, actor.companyId, 'Resignation awaiting review', `${employee.fullName} submitted a resignation.`, record.id);
  else for (const hr of await hrUsers(actor.companyId)) await notify(hr._id, actor.companyId, 'Resignation awaiting HR review', `${employee.fullName} submitted a resignation.`, record.id);
  return record.populate('employeeId', 'fullName employeeCode department designation role');
}

function visibility(actor) {
  if (HR_ROLES.includes(actor.role)) return { companyId: actor.companyId };
  if (['manager', 'floor_head', 'team_lead'].includes(actor.role)) {
    return { companyId: actor.companyId, $or: [{ employeeId: actor.id }, { 'approvals.approverId': actor.id }] };
  }
  return { companyId: actor.companyId, employeeId: actor.id };
}

async function list(query, actor) {
  const filter = visibility(actor);
  if (query.status) filter.status = query.status;
  const items = await Exit.find(filter).populate('employeeId', 'fullName employeeCode department designation role status')
    .populate('approvals.approverId', 'fullName role').sort('-createdAt').limit(500);
  return items;
}

async function getRecord(id, actor) {
  const record = await Exit.findOne({ _id: id, ...visibility(actor) });
  if (!record) throw createHttpError(404, 'Exit request not found.');
  return record;
}

async function review(id, body, actor) {
  const record = await getRecord(id, actor);
  if (record.status !== 'pending_approval') throw createHttpError(400, 'This request is not awaiting hierarchy approval.');
  const step = record.approvals[record.currentApprovalIndex];
  if (!step || String(step.approverId) !== String(actor.id)) throw createHttpError(403, 'This approval is not assigned to you.');
  step.status = body.action === 'reject' ? 'rejected' : (step.role === 'manager' ? 'recommended' : 'acknowledged');
  step.comments = body.comments; step.decidedAt = new Date();
  if (body.action === 'reject') record.status = 'rejected';
  else if (record.currentApprovalIndex + 1 < record.approvals.length) record.currentApprovalIndex += 1;
  else record.status = 'hr_review';
  await record.save();
  const employee = await Employee.findById(record.employeeId).select('fullName');
  if (record.status === 'pending_approval') {
    await notify(record.approvals[record.currentApprovalIndex].approverId, actor.companyId, 'Resignation awaiting review', `${employee.fullName}'s resignation requires your review.`, record.id);
  } else if (record.status === 'hr_review') {
    for (const hr of await hrUsers(actor.companyId)) await notify(hr._id, actor.companyId, 'Resignation awaiting HR decision', `${employee.fullName}'s resignation completed hierarchy review.`, record.id);
  } else await notify(record.employeeId, actor.companyId, 'Resignation rejected', 'Your resignation request was rejected during review.', record.id);
  return record;
}

async function decide(id, body, actor) {
  if (!HR_ROLES.includes(actor.role)) throw createHttpError(403, 'Only HR can make the final decision.');
  const record = await getRecord(id, actor);
  if (!['hr_review', 'accepted'].includes(record.status)) throw createHttpError(400, 'Request is not ready for an HR decision.');
  record.hrDecision = { action: body.action, comments: body.comments, decidedBy: actor.id, decidedAt: new Date() };
  record.finalLastWorkingDay = body.finalLastWorkingDay || record.proposedLastWorkingDay;
  record.status = body.action === 'reject' ? 'rejected' : 'clearance';
  await record.save();
  await notify(record.employeeId, actor.companyId, record.status === 'rejected' ? 'Resignation rejected' : 'Resignation accepted', record.status === 'rejected' ? 'HR rejected your resignation.' : 'HR accepted your resignation. Exit clearance has started.', record.id);
  return record;
}

async function updateClearance(id, body, actor) {
  if (!HR_ROLES.includes(actor.role)) throw createHttpError(403, 'Only HR can update exit clearance.');
  const record = await getRecord(id, actor);
  if (record.status !== 'clearance') throw createHttpError(400, 'Exit request is not in clearance.');
  if (body.checklist) record.checklist = record.checklist.map((item) => {
    const update = body.checklist.find((x) => x.key === item.key);
    if (!update) return item;
    item.completed = Boolean(update.completed); item.notes = update.notes;
    item.completedBy = update.completed ? actor.id : undefined; item.completedAt = update.completed ? new Date() : undefined;
    return item;
  });
  if (body.settlement) {
    const s = body.settlement;
    record.settlement = { ...record.settlement.toObject(), ...s,
      netPayable: Number(s.salaryUntilLastDay || 0) + Number(s.bonuses || 0) - Number(s.unpaidLeaveDeduction || 0) - Number(s.loanDeduction || 0) - Number(s.otherDeductions || 0) };
  }
  if (body.exitInterviewNotes !== undefined) record.exitInterviewNotes = body.exitInterviewNotes;
  await record.save(); return record;
}

async function complete(id, actor) {
  if (!HR_ROLES.includes(actor.role)) throw createHttpError(403, 'Only HR can complete an exit.');
  const record = await getRecord(id, actor);
  if (record.status !== 'clearance') throw createHttpError(400, 'Exit request is not in clearance.');
  if (record.checklist.some((x) => !x.completed)) throw createHttpError(400, 'Complete every clearance item first.');
  const employee = await Employee.findById(record.employeeId);
  employee.status = 'resigned'; employee.exitDate = record.finalLastWorkingDay; employee.exitReason = record.reason;
  employee.biometricDeviceUserId = undefined; employee.managerId = undefined; employee.floorHeadId = undefined; employee.teamLeadId = undefined;
  employee.tokenVersion = Number(employee.tokenVersion || 0) + 1;
  await employee.save();
  record.status = 'completed'; record.completedAt = new Date(); await record.save();
  await notify(record.employeeId, actor.companyId, 'Exit process completed', 'Your clearance and final settlement have been completed.', record.id);
  return record;
}

async function withdraw(id, actor) {
  const record = await getRecord(id, actor);
  if (String(record.employeeId) !== String(actor.id)) throw createHttpError(403, 'Only the employee can withdraw this request.');
  if (!['pending_approval', 'hr_review'].includes(record.status)) throw createHttpError(400, 'This resignation can no longer be withdrawn.');
  record.status = 'withdrawn'; record.withdrawnAt = new Date(); await record.save(); return record;
}

module.exports = { submit, list, review, decide, updateClearance, complete, withdraw };
