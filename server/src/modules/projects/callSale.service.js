const createHttpError = require('http-errors');
const CallSale = require('./callSale.model');
const Employee = require('../employees/employees.model');
const notifications = require('../notifications/notifications.service');
const { emitToUser } = require('../../config/socket');
const { isProbation } = require('./callTransfer.service');

const TARGETS = { employee: 2, team_lead: 5, floor_head: 15 };
const CALL_CENTER = /^call[\s_-]*center$/i;

function populate(query) {
  return query
    .populate('submittedBy', 'fullName employeeCode department designation role profilePicture')
    .populate('approvalChain.approverId', 'fullName employeeCode designation role')
    .populate('currentApproverId', 'fullName employeeCode designation role')
    .populate('finalApprovedBy', 'fullName employeeCode designation role');
}

async function employeeProfile(actor) {
  const employee = await Employee.findOne({ _id: actor.id, companyId: actor.companyId, status: 'active' })
    .select('fullName department managedDepartments designation role joiningDate managerId floorHeadId teamLeadId companyId');
  if (!employee) throw createHttpError(404, 'Employee profile not found.');
  return employee;
}

async function buildApprovalChain(employee) {
  const ids = [];
  let floorHeadId = employee.floorHeadId;
  let managerId = employee.managerId;
  if (employee.role === 'employee' && employee.teamLeadId) {
    ids.push(employee.teamLeadId);
    const teamLead = await Employee.findById(employee.teamLeadId).select('floorHeadId managerId');
    floorHeadId ||= teamLead?.floorHeadId;
    managerId ||= teamLead?.managerId;
  }
  if (['employee', 'team_lead'].includes(employee.role) && floorHeadId) ids.push(floorHeadId);
  if (managerId) ids.push(managerId);
  const uniqueIds = [...new Map(ids.map((id) => [String(id), id])).values()];
  const approvers = await Employee.find({
    _id: { $in: uniqueIds },
    companyId: employee.companyId,
    status: 'active',
  }).select('_id role');
  const byId = new Map(approvers.map((item) => [String(item._id), item]));
  const chain = uniqueIds.map((id) => byId.get(String(id))).filter(Boolean)
    .map((approver) => ({ approverId: approver._id, role: approver.role, status: 'pending' }));
  if (!chain.length || chain[chain.length - 1].role !== 'manager') {
    throw createHttpError(422, 'A Manager must be assigned before adding a sale.');
  }
  return chain;
}

async function context(actor) {
  const employee = await employeeProfile(actor);
  const hasCallCenterAccess = [employee.department, ...(employee.managedDepartments || [])]
    .some((department) => CALL_CENTER.test(department || ''));
  if (!hasCallCenterAccess) {
    throw createHttpError(403, 'Call Center projects are only available to Call Center employees.');
  }
  const employeeFilter = { companyId: actor.companyId, department: CALL_CENTER, status: 'active' };
  if (actor.role === 'team_lead') employeeFilter.teamLeadId = actor.id;
  else if (actor.role === 'floor_head') employeeFilter.floorHeadId = actor.id;
  else if (actor.role === 'manager') employeeFilter.managerId = actor.id;
  else employeeFilter._id = actor.id;
  const employees = await Employee.find(employeeFilter)
    .select('fullName employeeCode designation role joiningDate')
    .sort({ fullName: 1 });
  return {
    employee,
    isCallCenter: hasCallCenterAccess,
    afterProbation: !isProbation(employee),
    target: TARGETS[employee.role] || 0,
    products: ['pos', 'atm_service', 'accounting', 'osap', 'digital_media_service', 'pr', 'insurance'],
    employees,
  };
}

async function notifyApprover(sale, submitterName) {
  if (!sale.currentApproverId) return;
  await notifications.createNotification({
    recipientId: sale.currentApproverId,
    companyId: sale.companyId,
    type: 'call_sale_pending',
    title: 'Sale approval required',
    message: `${submitterName} submitted a sale requiring your approval.`,
    link: '/projects',
    metadata: { saleId: sale._id },
    dedupeKey: `call-sale-stage:${sale._id}:${sale.currentApproverId}`,
  });
  emitToUser(sale.currentApproverId, 'call-sale:changed', { id: sale._id, status: sale.status });
}

async function create(payload, actor) {
  const employee = await employeeProfile(actor);
  if (!CALL_CENTER.test(employee.department || '')) throw createHttpError(403, 'Sales are only available to Call Center users.');
  if (isProbation(employee)) throw createHttpError(422, 'Sales are available after completion of probation.');
  if (!TARGETS[employee.role]) throw createHttpError(403, 'Your role does not have a sales target.');
  const rawDate = payload.saleDate instanceof Date ? payload.saleDate.toISOString().slice(0, 10) : String(payload.saleDate || '').slice(0, 10);
  const saleDate = new Date(`${rawDate}T12:00:00.000Z`);
  if (Number.isNaN(saleDate.getTime())) throw createHttpError(422, 'A valid sale date is required.');
  const approvalChain = await buildApprovalChain(employee);
  const record = await CallSale.create({
    companyId: actor.companyId,
    submittedBy: actor.id,
    saleDate,
    businessName: payload.businessName,
    ownerName: payload.ownerName,
    details: String(payload.details || '').trim(),
    product: payload.product,
    targetMonth: saleDate.getUTCMonth() + 1,
    targetYear: saleDate.getUTCFullYear(),
    approvalChain,
    currentApproverId: approvalChain[0].approverId,
  });
  await notifyApprover(record, employee.fullName);
  return populate(CallSale.findById(record._id));
}

async function list(query, actor) {
  await context(actor);
  const filter = { companyId: actor.companyId };
  if (['manager', 'floor_head', 'team_lead'].includes(actor.role)) {
    filter.$or = [{ submittedBy: actor.id }, { 'approvalChain.approverId': actor.id }];
  } else filter.submittedBy = actor.id;
  if (query.status) filter.status = query.status;
  if (query.employeeId) filter.submittedBy = query.employeeId;
  if (query.product) filter.product = query.product;
  if (query.month) filter.targetMonth = Number(query.month);
  if (query.year) filter.targetYear = Number(query.year);
  const records = await populate(CallSale.find(filter).sort({ saleDate: -1, createdAt: -1 }));
  const progress = {};
  for (const record of records) {
    const submitter = record.submittedBy;
    const key = `${submitter?._id || submitter}:${record.targetYear}-${record.targetMonth}`;
    if (!progress[key]) progress[key] = { approved: 0, target: TARGETS[submitter?.role] || 0 };
    // Only Manager-finalized records ever receive approved status.
    if (record.status === 'approved' && record.finalApprovedBy) progress[key].approved += 1;
  }
  return { records, progress, targets: TARGETS };
}

async function decide(id, payload, actor) {
  await context(actor);
  const record = await CallSale.findOne({
    _id: id,
    companyId: actor.companyId,
    status: 'pending',
    currentApproverId: actor.id,
  });
  if (!record) throw createHttpError(404, 'Pending sale approval not found.');
  const stage = record.approvalChain.find((item) => (
    String(item.approverId) === String(actor.id) && item.status === 'pending'
  ));
  if (!stage) throw createHttpError(409, 'This approval stage has already been processed.');
  stage.status = payload.status;
  stage.reason = payload.reason || '';
  stage.decidedAt = new Date();
  if (payload.status === 'rejected') {
    record.status = 'rejected';
    record.currentApproverId = null;
  } else if (actor.role === 'manager') {
    // The sale becomes countable only at the Manager stage.
    record.status = 'approved';
    record.currentApproverId = null;
    record.finalApprovedBy = actor.id;
    record.finalApprovedAt = new Date();
  } else {
    const next = record.approvalChain.find((item) => item.status === 'pending');
    if (!next) throw createHttpError(422, 'Manager final approval stage is missing.');
    record.currentApproverId = next.approverId;
  }
  await record.save();
  const submitter = await Employee.findById(record.submittedBy).select('fullName role');
  if (record.status === 'pending') {
    await notifyApprover(record, submitter?.fullName || 'An employee');
  } else {
    const target = TARGETS[submitter?.role] || 0;
    const approvedCount = await CallSale.countDocuments({
      companyId: record.companyId,
      submittedBy: record.submittedBy,
      targetMonth: record.targetMonth,
      targetYear: record.targetYear,
      status: 'approved',
      finalApprovedBy: { $ne: null },
    });
    await notifications.createNotification({
      recipientId: record.submittedBy,
      companyId: record.companyId,
      type: `call_sale_${record.status}`,
      title: record.status === 'approved' ? 'Sale approved by Manager' : 'Sale rejected',
      message: record.status === 'approved'
        ? `Your sale is now counted. Monthly progress: ${Math.min(approvedCount, target)}/${target}.`
        : `Your sale was rejected${stage.reason ? `: ${stage.reason}` : '.'}`,
      link: '/projects',
      metadata: { saleId: record._id },
      dedupeKey: `call-sale-final:${record._id}`,
    });
    if (record.status === 'approved' && target && approvedCount >= target) {
      await notifications.createNotification({
        recipientId: record.submittedBy,
        companyId: record.companyId,
        type: 'call_sale_target_completed',
        title: 'Congratulations! Sales target completed',
        message: `You completed ${target}/${target} Manager-approved sales for ${record.targetMonth}/${record.targetYear}.`,
        link: '/projects',
        metadata: { month: record.targetMonth, year: record.targetYear },
        dedupeKey: `call-sale-target:${record.submittedBy}:${record.targetYear}:${record.targetMonth}`,
      });
    }
  }
  emitToUser(record.submittedBy, 'call-sale:changed', { id: record._id, status: record.status });
  return populate(CallSale.findById(record._id));
}

module.exports = { context, create, list, decide, TARGETS };
