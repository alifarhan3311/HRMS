const service = require('./notifications.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const list = asyncHandler(async (req, res) => {
  const result = await service.listNotifications(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const markRead = asyncHandler(async (req, res) => {
  const record = await service.markRead(req.params.id, req.user);
  res.status(200).json({ success: true, data: record });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await service.markAllRead(req.user);
  res.status(200).json({ success: true, ...result });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.removeNotification(req.params.id, req.user);
  res.status(200).json({ success: true, ...result });
});

const clear = asyncHandler(async (req, res) => {
  const result = await service.clearNotifications(req.user);
  res.status(200).json({ success: true, ...result });
});

module.exports = { list, markRead, markAllRead, remove, clear };
