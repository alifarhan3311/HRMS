/**
 * modules/attendance/attendance.controller.js
 */
const service = require('./attendance.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const signIn = asyncHandler(async (req, res) => {
  const record = await service.signIn(
    { employeeId: req.user.id, method: req.body.method, notes: req.body.notes },
    req.user
  );
  res.status(200).json({ success: true, data: record });
});

const signOut = asyncHandler(async (req, res) => {
  const record = await service.signOut(
    { employeeId: req.user.id, notes: req.body.notes },
    req.user
  );
  res.status(200).json({ success: true, data: record });
});

const today = asyncHandler(async (req, res) => {
  const record = await service.getTodayAttendance(req.user.id, req.user);
  res.status(200).json({ success: true, data: record || null });
});

const monthlySummary = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const employeeId = req.query.employeeId || req.user.id;
  const result = await service.getMonthlySummary(
    employeeId,
    Number(year) || new Date().getFullYear(),
    Number(month) || new Date().getMonth() + 1,
    req.user
  );
  res.status(200).json({ success: true, data: result });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listAttendances(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const record = await service.getAttendanceById(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const rangeSummary = asyncHandler(async (req, res) => {
  const employeeId = req.query.employeeId || req.user.id;
  const result = await service.getRangeSummary(
    employeeId,
    req.query.dateFrom,
    req.query.dateTo,
    req.user
  );
  res.status(200).json({ success: true, data: result });
});

const manualCorrection = asyncHandler(async (req, res) => {
  const record = await service.manualCorrection(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const requestRegularization = asyncHandler(async (req, res) => {
  const record = await service.requestRegularization(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const reviewRegularization = asyncHandler(async (req, res) => {
  const record = await service.reviewRegularization(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, data: record });
});

const pendingRegularizations = asyncHandler(async (req, res) => {
  const records = await service.getPendingRegularizations(req.user);
  res.status(200).json({ success: true, data: records });
});

module.exports = {
  signIn, signOut, today, monthlySummary, rangeSummary, list,
  getById, manualCorrection, requestRegularization,
  reviewRegularization, pendingRegularizations,
};
