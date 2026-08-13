const createHttpError = require('http-errors');
const AccountingTask = require('./accountingTask.model');
const Employee = require('../employees/employees.model');
const notifications = require('../notifications/notifications.service');
const { emitToUser } = require('../../config/socket');

const ACCOUNTING = /^account(?:ing|s)?$/i;

function hasAccountingAccess(employee) {
  return [employee.department, ...(employee.managedDepartments || [])]
    .some((department) => ACCOUNTING.test(String(department || '').trim()));
}

function populate(query) {
  return query
    .populate('submittedBy', 'fullName employeeCode department designation profilePicture teamLeadId')
    .populate('teamLeadId', 'fullName employeeCode designation')
    .populate('decidedBy', 'fullName employeeCode designation');
}

async function actorProfile(actor) {
  const employee = await Employee.findOne({
    _id: actor.id,
    companyId: actor.companyId,
    status: 'active',
  }).select('fullName department managedDepartments role teamLeadId managerId');
  if (!employee) throw createHttpError(404, 'Employee profile not found.');
  if (!hasAccountingAccess(employee)) {
    throw createHttpError(403, 'Accounting tasks are only available to Accounting employees.');
  }
  return employee;
}

async function context(actor) {
  const employee = await actorProfile(actor);
  let employeeFilter = { companyId: actor.companyId, department: ACCOUNTING, status: 'active' };
  if (actor.role === 'team_lead') employeeFilter = { ...employeeFilter, teamLeadId: actor.id };
  else if (actor.role !== 'manager') employeeFilter = { ...employeeFilter, _id: actor.id };

  const employees = await Employee.find(employeeFilter)
    .select('fullName employeeCode designation department teamLeadId')
    .sort({ fullName: 1 });
  return {
    employee,
    employees,
    canCreate: actor.role === 'employee',
    canDecide: actor.role === 'team_lead',
    canViewReports: ['team_lead', 'manager'].includes(actor.role),
  };
}

function parseTaskDate(value) {
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw createHttpError(422, 'A valid task date is required.');
  return date;
}

async function create(rows, actor) {
  const employee = await actorProfile(actor);
  if (actor.role !== 'employee') {
    throw createHttpError(403, 'Only Accounting employees can add their own tasks.');
  }
  if (!employee.teamLeadId) {
    throw createHttpError(422, 'A Team Lead must be assigned before adding a task.');
  }

  const records = rows.map((row) => ({
    companyId: actor.companyId,
    submittedBy: actor.id,
    teamLeadId: employee.teamLeadId,
    taskDate: parseTaskDate(row.taskDate),
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
  }));
  const created = await AccountingTask.insertMany(records, { ordered: true });

  await notifications.createNotification({
    recipientId: employee.teamLeadId,
    companyId: actor.companyId,
    type: 'accounting_tasks_pending',
    title: 'New Accounting tasks',
    message: `${employee.fullName} submitted ${created.length} task${created.length === 1 ? '' : 's'} for approval.`,
    link: '/projects',
    metadata: { taskIds: created.map((item) => item._id) },
    dedupeKey: `accounting-tasks-pending:${created.map((item) => item._id).join(':')}`,
  });
  emitToUser(employee.teamLeadId, 'accounting-task:changed', { status: 'pending' });
  return populate(AccountingTask.find({ _id: { $in: created.map((item) => item._id) } }));
}

async function list(query, actor) {
  await actorProfile(actor);
  const filter = { companyId: actor.companyId };
  if (actor.role === 'team_lead') filter.teamLeadId = actor.id;
  else if (actor.role !== 'manager') filter.submittedBy = actor.id;

  if (query.employeeId && ['team_lead', 'manager'].includes(actor.role)) {
    filter.submittedBy = query.employeeId;
  }
  if (query.status) filter.status = query.status;
  if (query.fromDate || query.toDate) {
    filter.taskDate = {};
    if (query.fromDate) filter.taskDate.$gte = new Date(`${String(query.fromDate).slice(0, 10)}T00:00:00.000Z`);
    if (query.toDate) filter.taskDate.$lte = new Date(`${String(query.toDate).slice(0, 10)}T23:59:59.999Z`);
  }

  const records = await populate(AccountingTask.find(filter).sort({ taskDate: -1, createdAt: -1 }));
  return {
    records,
    counts: {
      all: records.length,
      pending: records.filter((item) => item.status === 'pending').length,
      approved: records.filter((item) => item.status === 'approved').length,
      rejected: records.filter((item) => item.status === 'rejected').length,
    },
  };
}

async function decide(id, payload, actor) {
  await actorProfile(actor);
  if (actor.role !== 'team_lead') {
    throw createHttpError(403, 'Only the assigned Team Lead can decide an Accounting task.');
  }
  const record = await AccountingTask.findOne({
    _id: id,
    companyId: actor.companyId,
    teamLeadId: actor.id,
  });
  if (!record) throw createHttpError(404, 'Accounting task not found.');
  if (record.status !== 'pending') throw createHttpError(409, 'This task has already been decided.');

  record.status = payload.status;
  record.decisionReason = String(payload.reason || '').trim();
  record.decidedBy = actor.id;
  record.decidedAt = new Date();
  await record.save();

  await notifications.createNotification({
    recipientId: record.submittedBy,
    companyId: record.companyId,
    type: `accounting_task_${record.status}`,
    title: record.status === 'approved' ? 'Task approved' : 'Task rejected',
    message: record.status === 'approved'
      ? `Your task "${record.title}" was approved.`
      : `Your task "${record.title}" was rejected${record.decisionReason ? `: ${record.decisionReason}` : '.'}`,
    link: '/projects',
    metadata: { taskId: record._id },
    dedupeKey: `accounting-task-decision:${record._id}:${record.resubmissionCount}:${record.status}`,
  });
  emitToUser(record.submittedBy, 'accounting-task:changed', { id: record._id, status: record.status });
  return populate(AccountingTask.findById(record._id));
}

async function resubmit(id, payload, actor) {
  const employee = await actorProfile(actor);
  if (actor.role !== 'employee') {
    throw createHttpError(403, 'Only the employee who submitted the task can edit it.');
  }
  const record = await AccountingTask.findOne({
    _id: id, companyId: actor.companyId, submittedBy: actor.id,
  });
  if (!record) throw createHttpError(404, 'Accounting task not found.');
  if (record.status !== 'rejected') {
    throw createHttpError(409, 'Only a rejected task can be edited and resubmitted.');
  }

  record.revisions.push({
    taskDate: record.taskDate,
    title: record.title,
    description: record.description,
    rejectionReason: record.decisionReason,
    rejectedBy: record.decidedBy,
    rejectedAt: record.decidedAt,
    resubmittedAt: new Date(),
  });
  record.taskDate = parseTaskDate(payload.taskDate);
  record.title = String(payload.title || '').trim();
  record.description = String(payload.description || '').trim();
  record.status = 'pending';
  record.resubmissionCount += 1;
  record.decisionReason = undefined;
  record.decidedBy = undefined;
  record.decidedAt = undefined;
  await record.save();

  let managerId = employee.managerId;
  if (!managerId) {
    const manager = await Employee.findOne({
      companyId: actor.companyId, role: 'manager', status: 'active',
      $or: [{ department: ACCOUNTING }, { managedDepartments: ACCOUNTING }],
    }).select('_id');
    managerId = manager?._id;
  }
  const recipients = [...new Set([record.teamLeadId, managerId].filter(Boolean).map(String))];
  for (const recipientId of recipients) {
    await notifications.createNotification({
      recipientId,
      companyId: actor.companyId,
      type: 'accounting_task_resubmitted',
      title: 'Accounting task resubmitted',
      message: `${employee.fullName} edited and resubmitted the task "${record.title}".`,
      link: '/projects',
      metadata: { taskId: record._id, resubmissionCount: record.resubmissionCount },
      dedupeKey: `accounting-task-resubmitted:${record._id}:${record.resubmissionCount}:${recipientId}`,
    });
    emitToUser(recipientId, 'accounting-task:changed', { id: record._id, status: 'pending' });
  }
  return populate(AccountingTask.findById(record._id));
}

module.exports = { context, create, list, decide, resubmit, hasAccountingAccess };
