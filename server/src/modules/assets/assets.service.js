const createHttpError = require('http-errors');
const Asset = require('./assets.model');
const AssetAssignment = require('./assetAssignment.model');
const AssetMaintenance = require('./assetMaintenance.model');
const AssetHistory = require('./assetHistory.model');
const Employee = require('../employees/employees.model');
const EmployeeExit = require('../exits/exits.model');
const notificationService = require('../notifications/notifications.service');

const MANAGE_ROLES = ['super_admin', 'admin', 'hr'];
const isManager = actor => MANAGE_ROLES.includes(actor.role);
const clean = value => (value === '' || value === null ? undefined : value);

function normalizePayload(payload) {
  const result = { ...payload };
  for (const key of ['brand', 'model', 'serialNumber', 'vendor', 'department', 'location', 'condition', 'notes']) {
    if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = clean(result[key]);
  }
  if (result.assetCode) result.assetCode = result.assetCode.trim().toUpperCase();
  return result;
}

async function history(asset, actor, action, details = {}) {
  return AssetHistory.create({
    companyId: asset.companyId,
    assetId: asset._id,
    action,
    changedBy: actor.id,
    ...details,
  });
}

function visibility(actor) {
  return isManager(actor)
    ? { companyId: actor.companyId }
    : { companyId: actor.companyId, assignedEmployeeId: actor.id };
}

async function getAssetForActor(id, actor) {
  const asset = await Asset.findOne({ _id: id, ...visibility(actor) });
  if (!asset) throw createHttpError(404, 'Asset not found.');
  return asset;
}

async function createAsset(payload, actor) {
  const asset = await Asset.create({
    ...normalizePayload(payload),
    companyId: actor.companyId,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await history(asset, actor, 'asset_created', { newStatus: asset.status, notes: asset.notes });
  return getAssetDetails(asset._id, actor);
}

async function updateAsset(id, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  const previous = asset.toObject();
  Object.assign(asset, normalizePayload(payload), { updatedBy: actor.id });
  await asset.save();
  await history(asset, actor, 'asset_updated', {
    previousStatus: previous.status,
    newStatus: asset.status,
    metadata: { changedFields: Object.keys(payload) },
  });
  return getAssetDetails(id, actor);
}

async function listAssets(query, actor) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 100);
  const filter = visibility(actor);
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.department) filter.department = query.department;
  if (query.employeeId && isManager(actor)) filter.assignedEmployeeId = query.employeeId;
  if (query.warranty === 'expired') filter.warrantyExpiryDate = { $lt: new Date() };
  if (query.warranty === 'expiring') {
    filter.warrantyExpiryDate = { $gte: new Date(), $lte: new Date(Date.now() + 30 * 86400000) };
  }
  if (query.search) {
    const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    const employeeIds = await Employee.find({ companyId: actor.companyId, fullName: pattern }).distinct('_id');
    filter.$or = [
      { assetCode: pattern }, { name: pattern }, { serialNumber: pattern },
      { brand: pattern }, { model: pattern }, { assignedEmployeeId: { $in: employeeIds } },
    ];
  }
  const [items, total] = await Promise.all([
    Asset.find(filter)
      .populate('assignedEmployeeId', 'fullName employeeCode department designation status')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
    Asset.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getDashboard(actor) {
  const filter = visibility(actor);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000);
  const [total, assigned, inStock, underRepair, warrantyExpiring, lostStolen, categories, pendingExitEmployeeIds] = await Promise.all([
    Asset.countDocuments(filter),
    Asset.countDocuments({ ...filter, status: 'assigned' }),
    Asset.countDocuments({ ...filter, status: { $in: ['in_stock', 'returned'] } }),
    Asset.countDocuments({ ...filter, status: 'under_repair' }),
    Asset.countDocuments({ ...filter, warrantyExpiryDate: { $gte: now, $lte: in30Days } }),
    Asset.countDocuments({ ...filter, status: { $in: ['lost', 'stolen'] } }),
    Asset.distinct('category', filter),
    isManager(actor)
      ? EmployeeExit.find({ companyId: actor.companyId, status: 'clearance' }).distinct('employeeId')
      : Promise.resolve([]),
  ]);
  const pendingReturns = pendingExitEmployeeIds.length
    ? await Asset.countDocuments({ companyId: actor.companyId, assignedEmployeeId: { $in: pendingExitEmployeeIds } })
    : 0;
  return { total, assigned, inStock, underRepair, warrantyExpiring, lostStolen, pendingReturns, categories: categories.sort() };
}

async function getAssetDetails(id, actor) {
  const asset = await Asset.findOne({ _id: id, ...visibility(actor) })
    .populate('assignedEmployeeId', 'fullName employeeCode department designation status')
    .populate('createdBy updatedBy', 'fullName employeeCode')
    .lean();
  if (!asset) throw createHttpError(404, 'Asset not found.');
  const [assignments, maintenance, events] = await Promise.all([
    AssetAssignment.find({ assetId: asset._id, companyId: actor.companyId })
      .populate('employeeId', 'fullName employeeCode department designation')
      .populate('assignedBy receivedBy', 'fullName employeeCode').sort('-assignmentDate').lean(),
    AssetMaintenance.find({ assetId: asset._id, companyId: actor.companyId })
      .populate('createdBy updatedBy', 'fullName employeeCode').sort('-reportedDate').lean(),
    AssetHistory.find({ assetId: asset._id, companyId: actor.companyId })
      .populate('employeeId changedBy', 'fullName employeeCode').sort('-createdAt').lean(),
  ]);
  return {
    ...asset,
    assignments,
    maintenance,
    history: events,
    maintenanceSummary: {
      repairs: maintenance.length,
      totalCost: maintenance.reduce((sum, item) => sum + Number(item.repairCost || 0), 0),
    },
  };
}

async function assignAsset(id, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  if (!['in_stock', 'returned'].includes(asset.status) || asset.assignedEmployeeId) {
    throw createHttpError(409, 'Only an available asset can be assigned.');
  }
  const employee = await Employee.findOne({
    _id: payload.employeeId,
    companyId: actor.companyId,
    status: { $in: ['active', 'on_leave'] },
  });
  if (!employee) throw createHttpError(422, 'Select an active employee.');
  const assignment = await AssetAssignment.create({
    companyId: actor.companyId,
    assetId: asset._id,
    employeeId: employee._id,
    assignmentDate: payload.assignmentDate,
    conditionAtAssignment: payload.conditionAtAssignment || asset.condition,
    assignedBy: actor.id,
    assignmentNotes: payload.notes,
  });
  const previousStatus = asset.status;
  asset.status = 'assigned';
  asset.assignedEmployeeId = employee._id;
  asset.currentAssignmentId = assignment._id;
  asset.condition = payload.conditionAtAssignment || asset.condition;
  asset.updatedBy = actor.id;
  await asset.save();
  await history(asset, actor, 'asset_assigned', {
    previousStatus, newStatus: 'assigned', employeeId: employee._id, notes: payload.notes,
    metadata: { assignmentId: assignment._id },
  });
  await notificationService.createNotification({
    recipientId: employee._id,
    companyId: actor.companyId,
    type: 'asset_assigned',
    title: 'Company asset assigned',
    message: `${asset.name} (${asset.assetCode}) has been assigned to you.`,
    link: '/assets',
    metadata: { assetId: asset._id, assignmentId: assignment._id },
    dedupeKey: `asset-assigned:${assignment._id}`,
  });
  return getAssetDetails(id, actor);
}

async function returnAsset(id, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  if (!asset.currentAssignmentId || !asset.assignedEmployeeId) throw createHttpError(409, 'This asset has no active assignment.');
  const assignment = await AssetAssignment.findOne({
    _id: asset.currentAssignmentId, assetId: asset._id, companyId: actor.companyId,
    status: { $in: ['active', 'lost', 'stolen'] },
  });
  if (!assignment) throw createHttpError(409, 'Active assignment history is missing.');
  assignment.returnDate = payload.returnDate;
  assignment.conditionAtReturn = payload.conditionAtReturn || asset.condition;
  assignment.receivedBy = actor.id;
  assignment.returnNotes = payload.notes;
  assignment.status = 'returned';
  await assignment.save();
  const employeeId = asset.assignedEmployeeId;
  const previousStatus = asset.status;
  asset.status = 'in_stock';
  asset.assignedEmployeeId = null;
  asset.currentAssignmentId = null;
  asset.condition = payload.conditionAtReturn || asset.condition;
  asset.updatedBy = actor.id;
  await asset.save();
  await history(asset, actor, 'asset_returned', {
    previousStatus, newStatus: 'in_stock', employeeId, notes: payload.notes,
    metadata: { assignmentId: assignment._id },
  });
  return getAssetDetails(id, actor);
}

async function changeStatus(id, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  if (['retired', 'disposed', 'in_stock'].includes(payload.status) && asset.assignedEmployeeId) {
    throw createHttpError(409, 'Return the assigned asset before changing to this status.');
  }
  const previousStatus = asset.status;
  asset.status = payload.status;
  asset.updatedBy = actor.id;
  if (['lost', 'stolen'].includes(payload.status)) {
    asset.incident = {
      type: payload.status,
      date: payload.date,
      employeeId: asset.assignedEmployeeId,
      description: payload.description,
      reportedBy: actor.id,
      notes: payload.notes,
    };
    if (asset.currentAssignmentId) {
      await AssetAssignment.updateOne({ _id: asset.currentAssignmentId }, { $set: { status: payload.status } });
    }
  }
  await asset.save();
  await history(asset, actor, `asset_${payload.status}`, {
    previousStatus, newStatus: payload.status, employeeId: asset.assignedEmployeeId,
    reason: payload.reason || payload.description, notes: payload.notes,
  });
  return getAssetDetails(id, actor);
}

async function addMaintenance(id, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  const record = await AssetMaintenance.create({
    ...payload,
    companyId: actor.companyId,
    assetId: asset._id,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  const previousStatus = asset.status;
  if (['reported', 'in_repair'].includes(record.status)) asset.status = 'under_repair';
  if (record.status === 'completed') asset.status = asset.assignedEmployeeId ? 'assigned' : 'in_stock';
  asset.updatedBy = actor.id;
  await asset.save();
  await history(asset, actor, record.status === 'completed' ? 'repair_completed' : 'sent_for_repair', {
    previousStatus, newStatus: asset.status, reason: record.issue,
    metadata: { maintenanceId: record._id, repairCost: record.repairCost },
  });
  return getAssetDetails(id, actor);
}

async function updateMaintenance(id, maintenanceId, payload, actor) {
  const asset = await getAssetForActor(id, actor);
  const record = await AssetMaintenance.findOneAndUpdate(
    { _id: maintenanceId, assetId: asset._id, companyId: actor.companyId },
    { $set: { ...payload, updatedBy: actor.id } },
    { new: true, runValidators: true },
  );
  if (!record) throw createHttpError(404, 'Maintenance record not found.');
  if (record.status === 'completed') {
    const previousStatus = asset.status;
    asset.status = asset.assignedEmployeeId ? 'assigned' : 'in_stock';
    asset.updatedBy = actor.id;
    await asset.save();
    await history(asset, actor, 'repair_completed', {
      previousStatus, newStatus: asset.status, reason: record.issue,
      metadata: { maintenanceId: record._id, repairCost: record.repairCost },
    });
  }
  return getAssetDetails(id, actor);
}

async function getEmployeeAssets(employeeId, actor) {
  const targetId = isManager(actor) ? employeeId : actor.id;
  const employee = await Employee.findOne({ _id: targetId, companyId: actor.companyId }).select('fullName employeeCode status');
  if (!employee) throw createHttpError(404, 'Employee not found.');
  const items = await Asset.find({ companyId: actor.companyId, assignedEmployeeId: targetId })
    .populate('assignedEmployeeId', 'fullName employeeCode department designation').sort('name').lean();
  return { employee, items, pending: items.filter(item => !['lost', 'stolen'].includes(item.status)).length };
}

async function processAssetExpiryNotifications(now = new Date()) {
  const deadline = new Date(now.getTime() + 30 * 86400000);
  const companies = await Asset.distinct('companyId', { warrantyExpiryDate: { $lte: deadline } });
  let sent = 0;
  for (const companyId of companies) {
    const [recipients, assets] = await Promise.all([
      Employee.find({ companyId, role: { $in: MANAGE_ROLES }, status: 'active' }).select('_id').lean(),
      Asset.find({
        companyId,
        status: { $nin: ['disposed'] },
        warrantyExpiryDate: { $lte: deadline },
      }).select('assetCode name warrantyExpiryDate').lean(),
    ]);
    for (const asset of assets) {
      const date = new Date(asset.warrantyExpiryDate);
      const dateKey = date.toISOString().slice(0, 10);
      const expired = date < now;
      for (const recipient of recipients) {
        await notificationService.createNotification({
          recipientId: recipient._id,
          companyId,
          type: 'asset_expiry',
          title: expired ? 'Asset warranty overdue' : 'Asset warranty approaching',
          message: `${asset.name} (${asset.assetCode}) warranty ${expired ? 'expired on' : 'expires on'} ${date.toLocaleDateString('en-GB')}.`,
          link: '/assets',
          metadata: { assetId: asset._id, expiryType: 'Warranty', expiryDate: date },
          dedupeKey: `asset-warranty:${asset._id}:${dateKey}:${recipient._id}`,
        });
        sent += 1;
      }
    }
  }
  return sent;
}

module.exports = {
  createAsset, updateAsset, listAssets, getDashboard, getAssetDetails,
  assignAsset, returnAsset, changeStatus, addMaintenance, updateMaintenance,
  getEmployeeAssets,
  processAssetExpiryNotifications,
};
