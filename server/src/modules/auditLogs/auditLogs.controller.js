const service = require('./auditLogs.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const list = asyncHandler(async (req, res) => {
  const result = await service.listAuditLogs(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

module.exports = { list };
