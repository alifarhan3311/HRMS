const AuditLog = require('./auditLogs.model');

async function listAuditLogs(query, actor) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
  const filter = actor.role === 'super_admin' && query.companyId
    ? { companyId: query.companyId }
    : { companyId: actor.companyId };

  if (query.userId) filter.userId = query.userId;
  if (query.action) filter.action = query.action;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'fullName employeeCode role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { listAuditLogs };
