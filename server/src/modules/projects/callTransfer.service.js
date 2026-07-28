const createHttpError = require('http-errors');
const CallTransfer = require('./callTransfer.model');
const Employee = require('../employees/employees.model');
const notifications = require('../notifications/notifications.service');
const { emitToUser } = require('../../config/socket');

const TARGET = 3;
const CALL_CENTER = /^call[\s_-]*center$/i;

function isManagement(role) {
  return ['hr', 'admin', 'super_admin', 'manager'].includes(role);
}

function isProbation(employee, date = new Date()) {
  const joined = new Date(employee.joiningDate);
  const completed = new Date(joined);
  completed.setMonth(completed.getMonth() + 3);
  return date < completed;
}

function populate(query) {
  return query
    .populate('submittedBy', 'fullName employeeCode department designation profilePicture joiningDate teamLeadId')
    .populate('transferredEmployeeId', 'fullName employeeCode department designation')
    .populate('ownerManagerId', 'fullName employeeCode designation role')
    .populate('teamLeadId', 'fullName employeeCode designation')
    .populate('decidedBy', 'fullName employeeCode');
}

async function context(actor) {
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId, status: 'active' })
    .select('fullName department role joiningDate teamLeadId managerId');
  if (!employee) throw createHttpError(404, 'Employee profile not found.');
  const departmentFilter = isManagement(actor.role)
    ? { department: CALL_CENTER }
    : { department: employee.department };
  const sameDepartment = {
    companyId: actor.companyId,
    ...departmentFilter,
    status: 'active',
  };
  const [employees] = await Promise.all([
    Employee.find(sameDepartment).select('fullName employeeCode designation role department joiningDate teamLeadId').sort({ fullName: 1 }),
  ]);
  return {
    employee,
    underProbation: isProbation(employee),
    isCallCenter: CALL_CENTER.test(employee.department || ''),
    target: TARGET,
    employees,
  };
}

async function create(payload, actor) {
  const data = await context(actor);
  if (!data.isCallCenter) throw createHttpError(403, 'Call transfers are only available to Call Center employees.');
  if (!data.underProbation) throw createHttpError(422, 'Only employees under probation can add transfers.');
  if (!data.employee.teamLeadId) throw createHttpError(422, 'A Team Lead must be assigned before adding a transfer.');
  const rawTransferDate = payload.transferDate instanceof Date
    ? payload.transferDate.toISOString().slice(0, 10)
    : String(payload.transferDate || '').slice(0, 10);
  const transferDate = new Date(`${rawTransferDate}T12:00:00.000Z`);
  if (Number.isNaN(transferDate.getTime())) throw createHttpError(422, 'A valid transfer date is required.');
  const allowedIds = new Set(data.employees.map((item) => String(item._id)));
  if (!allowedIds.has(String(payload.transferredEmployeeId))) throw createHttpError(422, 'Selected employee is outside your department.');
  const businessOwnerName = String(payload.businessOwnerName || '').trim();
  if (businessOwnerName.length < 2) throw createHttpError(422, 'Business owner name is required.');
  const record = await CallTransfer.create({
    companyId: actor.companyId,
    submittedBy: actor.id,
    transferredEmployeeId: payload.transferredEmployeeId,
    businessOwnerName,
    teamLeadId: data.employee.teamLeadId,
    transferDate,
    targetMonth: transferDate.getUTCMonth() + 1,
    targetYear: transferDate.getUTCFullYear(),
  });
  await notifications.createNotification({
    recipientId: data.employee.teamLeadId,
    companyId: actor.companyId,
    type: 'call_transfer_pending',
    title: 'New call transfer',
    message: `${data.employee.fullName} submitted a call transfer for approval.`,
    link: '/projects',
    metadata: { transferId: record._id },
    dedupeKey: `call-transfer-pending:${record._id}`,
  });
  emitToUser(data.employee.teamLeadId, 'call-transfer:changed', { id: record._id, status: 'pending' });
  return populate(CallTransfer.findById(record._id));
}

async function list(query, actor) {
  const filter = { companyId: actor.companyId };
  if (actor.role === 'team_lead') filter.teamLeadId = actor.id;
  else if (!isManagement(actor.role)) filter.submittedBy = actor.id;
  if (query.status) filter.status = query.status;
  if (query.employeeId) filter.submittedBy = query.employeeId;
  if (query.month) filter.targetMonth = Number(query.month);
  if (query.year) filter.targetYear = Number(query.year);
  if (query.ownerManagerId) filter.ownerManagerId = query.ownerManagerId;
  const records = await populate(CallTransfer.find(filter).sort({ transferDate: -1, createdAt: -1 }));
  const progress = {};
  for (const record of records) {
    const key = `${record.submittedBy?._id || record.submittedBy}:${record.targetYear}-${record.targetMonth}`;
    if (!progress[key]) progress[key] = { approved: 0, target: TARGET };
    if (record.status === 'approved') progress[key].approved += 1;
  }
  return { records, progress, target: TARGET };
}

async function decide(id, payload, actor) {
  if (actor.role !== 'team_lead') throw createHttpError(403, 'Only the assigned Team Lead can decide a transfer.');
  const record = await CallTransfer.findOne({ _id: id, companyId: actor.companyId, teamLeadId: actor.id });
  if (!record) throw createHttpError(404, 'Transfer not found.');
  if (record.status !== 'pending') throw createHttpError(409, 'This transfer has already been decided.');
  record.status = payload.status;
  record.decisionReason = payload.reason || '';
  record.decidedBy = actor.id;
  record.decidedAt = new Date();
  await record.save();
  const approvedCount = await CallTransfer.countDocuments({
    companyId: record.companyId,
    submittedBy: record.submittedBy,
    targetMonth: record.targetMonth,
    targetYear: record.targetYear,
    status: 'approved',
  });
  const completed = approvedCount >= TARGET;
  await notifications.createNotification({
    recipientId: record.submittedBy,
    companyId: record.companyId,
    type: `call_transfer_${record.status}`,
    title: record.status === 'approved' ? 'Transfer approved' : 'Transfer rejected',
    message: record.status === 'approved'
      ? `Your transfer was approved. Monthly progress: ${Math.min(approvedCount, TARGET)}/${TARGET}.`
      : `Your transfer was rejected${record.decisionReason ? `: ${record.decisionReason}` : '.'}`,
    link: '/projects',
    metadata: { transferId: record._id },
    dedupeKey: `call-transfer-decision:${record._id}`,
  });
  if (completed) {
    await notifications.createNotification({
      recipientId: record.submittedBy,
      companyId: record.companyId,
      type: 'call_transfer_target_completed',
      title: 'Congratulations! Monthly target completed',
      message: `You completed ${TARGET}/${TARGET} approved transfers for ${record.targetMonth}/${record.targetYear}.`,
      link: '/projects',
      metadata: { month: record.targetMonth, year: record.targetYear },
      dedupeKey: `call-transfer-target:${record.submittedBy}:${record.targetYear}:${record.targetMonth}`,
    });
  }
  emitToUser(record.submittedBy, 'call-transfer:changed', { id: record._id, status: record.status, completed });
  return { record: await populate(CallTransfer.findById(record._id)), approvedCount, target: TARGET, completed };
}

module.exports = { context, create, list, decide, isProbation };
