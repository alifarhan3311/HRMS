/**
 * modules/payroll/payroll.controller.js
 */

const service = require('./payroll.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const generate = asyncHandler(async (req, res) => {
  const record = await service.generatePayslip(req.body, req.user);
  res.status(201).json({ success: true, data: record });
});

const bulkGenerate = asyncHandler(async (req, res) => {
  const result = await service.bulkGeneratePayslips(req.body, req.user);
  res.status(201).json({ success: true, data: result });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listPayslips(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const live = asyncHandler(async (req, res) => {
  const result = await service.getLivePayroll(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const record = await service.getPayslipById(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const update = asyncHandler(async (req, res) => {
  const record = await service.updatePayslip(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const approve = asyncHandler(async (req, res) => {
  const record = await service.approvePayslip(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const markPaid = asyncHandler(async (req, res) => {
  const record = await service.markPaid(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const clearPeriod = asyncHandler(async (req, res) => {
  const result = await service.clearPayrollPeriod(req.body, req.user);
  req.auditContext = {
    action: 'payroll.clear_period', resourceType: 'payroll',
    resourceId: `${result.year}-${String(result.month).padStart(2, '0')}`,
  };
  res.status(200).json({ success: true, data: result });
});

module.exports = { generate, bulkGenerate, list, live, getById, update, approve, markPaid, clearPeriod };
