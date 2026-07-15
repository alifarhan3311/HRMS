/**
 * modules/dashboard/dashboard.controller.js
 */
const service = require('./dashboard.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const getSummary = asyncHandler(async (req, res) => {
  const data = await service.getDashboardForUser(req.user);
  res.status(200).json({ success: true, data });
});

module.exports = { getSummary };
