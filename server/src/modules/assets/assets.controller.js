const service = require('./assets.service');
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  types: asyncHandler(async (req, res) => res.json({ success: true, data: await service.listAssetTypes(req.user) })),
  createType: asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createAssetType(req.body, req.user) })),
  dashboard: asyncHandler(async (req, res) => res.json({ success: true, data: await service.getDashboard(req.user) })),
  list: asyncHandler(async (req, res) => res.json({ success: true, ...await service.listAssets(req.query, req.user) })),
  detail: asyncHandler(async (req, res) => res.json({ success: true, data: await service.getAssetDetails(req.params.id, req.user) })),
  create: asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createAsset(req.body, req.user) })),
  update: asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateAsset(req.params.id, req.body, req.user) })),
  assign: asyncHandler(async (req, res) => res.json({ success: true, data: await service.assignAsset(req.params.id, req.body, req.user) })),
  returnAsset: asyncHandler(async (req, res) => res.json({ success: true, data: await service.returnAsset(req.params.id, req.body, req.user) })),
  status: asyncHandler(async (req, res) => res.json({ success: true, data: await service.changeStatus(req.params.id, req.body, req.user) })),
  addMaintenance: asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.addMaintenance(req.params.id, req.body, req.user) })),
  updateMaintenance: asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateMaintenance(req.params.id, req.params.maintenanceId, req.body, req.user) })),
  employeeAssets: asyncHandler(async (req, res) => res.json({ success: true, data: await service.getEmployeeAssets(req.params.employeeId, req.user) })),
  allocationSummary: asyncHandler(async (req, res) => res.json({ success: true, data: await service.getEmployeeAllocationSummary(req.user) })),
  allocationOptions: asyncHandler(async (req, res) => res.json({ success: true, data: await service.getEmployeeAllocationOptions(req.params.employeeId, req.user) })),
  syncAllocation: asyncHandler(async (req, res) => res.json({ success: true, data: await service.syncEmployeeAssets(req.params.employeeId, req.body, req.user) })),
};
