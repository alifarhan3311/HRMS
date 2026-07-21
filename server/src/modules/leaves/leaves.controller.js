/**
 * modules/leaves/leaves.controller.js
 */
const service = require('./leaves.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const apply = asyncHandler(async (req, res) => {
  const record = await service.applyLeave(req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listLeaves(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const record = await service.getLeaveById(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const approve = asyncHandler(async (req, res) => {
  const record = await service.approveLeave(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const reject = asyncHandler(async (req, res) => {
  const record = await service.rejectLeave(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const cancel = asyncHandler(async (req, res) => {
  const record = await service.cancelLeave(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const pendingApprovals = asyncHandler(async (req, res) => {
  const records = await service.getPendingApprovals(req.user);
  res.status(200).json({ success: true, data: records });
});

module.exports = { apply, list, getById, approve, reject, cancel, pendingApprovals };
