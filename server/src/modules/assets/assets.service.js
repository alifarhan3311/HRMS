const createHttpError = require('http-errors');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Asset = require('./assets.model');
const AssetAssignment = require('./assetAssignment.model');
const AssetMaintenance = require('./assetMaintenance.model');
const AssetHistory = require('./assetHistory.model');
const AssetType = require('./assetType.model');
const Employee = require('../employees/employees.model');
const EmployeeExit = require('../exits/exits.model');
const notificationService = require('../notifications/notifications.service');

const MANAGE_ROLES = ['super_admin', 'admin', 'hr'];
const DEFAULT_ASSET_TYPES = ['Laptop', 'Desktop', 'Monitor', 'Mouse', 'Charger', 'Mobile Phone', 'SIM', 'Headset', 'Printer', 'Attendance Machine', 'Access Card', 'Office Keys'];
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
  const { employeeId, quantity = 1, ...input } = normalizePayload(payload);
  if (Number(quantity) > 1) {
    const items = [];
    for (let index = 0; index < Number(quantity); index += 1) {
      items.push(await createAsset({ ...input, employeeId, quantity: 1 }, actor));
    }
    return { items, quantity: items.length };
  }
  let employee;
  if (employeeId) {
    employee = await Employee.findOne({
      _id: employeeId, companyId: actor.companyId, status: { $in: ['active', 'on_leave'] },
    }).select('_id department');
    if (!employee) throw createHttpError(422, 'Select an active employee.');
  }
  input.name = [input.brand, input.model].filter(Boolean).join(' ') || input.category;
  input.serialNumber = input.serialNumber || `AUTO-${String(input.category).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  input.department = input.department || employee?.department;
  let asset;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      asset = await Asset.create({
        ...input,
        assetCode: `AST-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        companyId: actor.companyId,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      break;
    } catch (error) {
      if (error?.code !== 11000 || !error?.keyPattern?.assetCode || attempt === 4) throw error;
    }
  }
  await history(asset, actor, 'asset_created', { newStatus: asset.status, notes: asset.notes });
  if (employee) {
    return assignAsset(asset._id, {
      employeeId: employee._id,
      assignmentDate: new Date(),
      conditionAtAssignment: 'Good',
      notes: 'Assigned while creating asset.',
    }, actor);
  }
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
  const [total, assigned, inStock, underRepair, warrantyExpiring, lostStolen, categories, categoryBreakdown, pendingExitEmployeeIds] = await Promise.all([
    Asset.countDocuments(filter),
    Asset.countDocuments({ ...filter, status: 'assigned' }),
    Asset.countDocuments({ ...filter, status: { $in: ['in_stock', 'returned'] } }),
    Asset.countDocuments({ ...filter, status: 'under_repair' }),
    Asset.countDocuments({ ...filter, warrantyExpiryDate: { $gte: now, $lte: in30Days } }),
    Asset.countDocuments({ ...filter, status: { $in: ['lost', 'stolen'] } }),
    Asset.distinct('category', filter),
    Asset.aggregate([
      { $match: { ...filter, companyId: new mongoose.Types.ObjectId(actor.companyId) } },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          inUse: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $in: ['$status', ['in_stock', 'returned']] }, 1, 0] } },
          underRepair: { $sum: { $cond: [{ $eq: ['$status', 'under_repair'] }, 1, 0] } },
          lostStolen: { $sum: { $cond: [{ $in: ['$status', ['lost', 'stolen']] }, 1, 0] } },
          retiredDisposed: { $sum: { $cond: [{ $in: ['$status', ['retired', 'disposed']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    isManager(actor)
      ? EmployeeExit.find({ companyId: actor.companyId, status: 'clearance' }).distinct('employeeId')
      : Promise.resolve([]),
  ]);
  const pendingReturns = pendingExitEmployeeIds.length
    ? await Asset.countDocuments({ companyId: actor.companyId, assignedEmployeeId: { $in: pendingExitEmployeeIds } })
    : 0;
  return {
    total, assigned, inStock, underRepair, warrantyExpiring, lostStolen, pendingReturns,
    categories: categories.sort(),
    categoryBreakdown: categoryBreakdown.filter(item => String(item._id).toLowerCase() !== 'keyboard').map(item => ({
      category: item._id,
      total: item.total,
      inUse: item.inUse,
      available: item.available,
      underRepair: item.underRepair,
      lostStolen: item.lostStolen,
      retiredDisposed: item.retiredDisposed,
    })),
  };
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

async function getEmployeeAllocationSummary(actor) {
  const companyId = new mongoose.Types.ObjectId(actor.companyId);
  const rows = await Asset.aggregate([
    {
      $match: {
        companyId,
        assignedEmployeeId: { $ne: null },
        status: { $in: ['assigned', 'under_repair'] },
      },
    },
    {
      $group: {
        _id: '$assignedEmployeeId',
        count: { $sum: 1 },
        categories: { $addToSet: '$category' },
      },
    },
  ]);
  return rows.map(row => ({ employeeId: row._id, count: row.count, categories: row.categories.sort() }));
}

async function getEmployeeAllocationOptions(employeeId, actor) {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: actor.companyId,
    status: { $in: ['active', 'on_leave'] },
  }).select('fullName employeeCode department designation');
  if (!employee) throw createHttpError(404, 'Active employee not found.');

  const assets = await Asset.find({
    companyId: actor.companyId,
    $or: [
      { assignedEmployeeId: employee._id, status: { $in: ['assigned', 'under_repair'] } },
      { assignedEmployeeId: null, status: { $in: ['in_stock', 'returned'] } },
    ],
  }).select('assetCode name category brand model serialNumber status assignedEmployeeId condition')
    .sort({ category: 1, name: 1 }).lean();
  return {
    employee,
    items: assets,
    selectedAssetIds: assets
      .filter(asset => String(asset.assignedEmployeeId || '') === String(employee._id))
      .map(asset => asset._id),
  };
}

async function syncEmployeeAssets(employeeId, payload, actor) {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: actor.companyId,
    status: { $in: ['active', 'on_leave'] },
  }).select('_id');
  if (!employee) throw createHttpError(404, 'Active employee not found.');

  const requestedIds = [...new Set(payload.assetIds.map(String))];
  const [requestedAssets, currentAssets] = await Promise.all([
    Asset.find({
      _id: { $in: requestedIds },
      companyId: actor.companyId,
      $or: [
        { assignedEmployeeId: employee._id, status: { $in: ['assigned', 'under_repair'] } },
        { assignedEmployeeId: null, status: { $in: ['in_stock', 'returned'] } },
      ],
    }).select('_id status assignedEmployeeId'),
    Asset.find({ companyId: actor.companyId, assignedEmployeeId: employee._id, status: 'assigned' })
      .select('_id'),
  ]);
  if (requestedAssets.length !== requestedIds.length) {
    throw createHttpError(409, 'One or more selected assets are no longer available. Refresh and try again.');
  }

  const requestedSet = new Set(requestedIds);
  const currentSet = new Set(currentAssets.map(asset => String(asset._id)));
  const assignIds = requestedAssets
    .filter(asset => !asset.assignedEmployeeId && !currentSet.has(String(asset._id)))
    .map(asset => String(asset._id));
  const returnIds = [...currentSet].filter(id => !requestedSet.has(id));

  for (const assetId of returnIds) {
    await returnAsset(assetId, {
      returnDate: payload.assignmentDate,
      conditionAtReturn: 'Good',
      notes: payload.notes || 'Returned through employee asset allocation.',
    }, actor);
  }
  for (const assetId of assignIds) {
    await assignAsset(assetId, {
      employeeId: employee._id,
      assignmentDate: payload.assignmentDate,
      conditionAtAssignment: 'Good',
      notes: payload.notes || 'Assigned through employee asset allocation.',
    }, actor);
  }

  return {
    ...(await getEmployeeAllocationOptions(employee._id, actor)),
    assigned: assignIds.length,
    returned: returnIds.length,
  };
}

async function listAssetTypes(actor) {
  const customTypes = await AssetType.find({ companyId: actor.companyId }).select('name').sort('name').lean();
  return [...new Set([...DEFAULT_ASSET_TYPES, ...customTypes.map(item => item.name)])]
    .filter(name => String(name).toLowerCase() !== 'keyboard')
    .sort((a, b) => a.localeCompare(b));
}

async function createAssetType(payload, actor) {
  const name = payload.name.trim().replace(/\s+/g, ' ');
  const defaultType = DEFAULT_ASSET_TYPES.find(type => type.toLowerCase() === name.toLowerCase());
  if (defaultType) return { name: defaultType, existing: true };
  try {
    const type = await AssetType.create({ companyId: actor.companyId, name, createdBy: actor.id });
    return { name: type.name, existing: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await AssetType.findOne({ companyId: actor.companyId, name }).collation({ locale: 'en', strength: 2 });
    return { name: existing?.name || name, existing: true };
  }
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
  getEmployeeAllocationSummary, getEmployeeAllocationOptions, syncEmployeeAssets,
  listAssetTypes, createAssetType,
  processAssetExpiryNotifications,
};
