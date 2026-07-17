const service = require('./companySettings.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const get = asyncHandler(async (req, res) => {
  const settings = await service.getSettings(req.user.companyId);
  res.status(200).json({ success: true, data: settings });
});

const update = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.body, req.user);
  res.status(200).json({ success: true, data: settings });
});

module.exports = { get, update };
