const { getActionCenter } = require('./actionCenter.service');
exports.get = (req, res, next) => getActionCenter(req.query, req.user)
  .then((data) => res.json({ success: true, data })).catch(next);
