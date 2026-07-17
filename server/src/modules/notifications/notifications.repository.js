const Notification = require('./notifications.model');

async function create(data) {
  if (!data.dedupeKey) {
    return { notification: await Notification.create(data), created: true };
  }

  const existing = await Notification.findOne({ dedupeKey: data.dedupeKey });
  if (existing) return { notification: existing, created: false };

  try {
    return { notification: await Notification.create(data), created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return {
      notification: await Notification.findOne({ dedupeKey: data.dedupeKey }),
      created: false,
    };
  }
}

async function findAll({ recipientId, companyId, read, page = 1, limit = 20 }) {
  const filter = { recipientId, companyId };
  if (read === true) filter.readAt = { $ne: null };
  if (read === false) filter.readAt = null;

  const skip = (page - 1) * limit;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId, companyId, readAt: null }),
  ]);

  return { items, total, unread, page, limit, totalPages: Math.ceil(total / limit) };
}

async function findOwnedById(id, recipientId, companyId) {
  return Notification.findOne({ _id: id, recipientId, companyId });
}

async function markRead(id, recipientId, companyId) {
  return Notification.findOneAndUpdate(
    { _id: id, recipientId, companyId },
    { $set: { readAt: new Date() } },
    { new: true }
  );
}

async function markAllRead(recipientId, companyId) {
  return Notification.updateMany(
    { recipientId, companyId, readAt: null },
    { $set: { readAt: new Date() } }
  );
}

async function remove(id, recipientId, companyId) {
  return Notification.findOneAndDelete({ _id: id, recipientId, companyId });
}

async function clear(recipientId, companyId) {
  return Notification.deleteMany({ recipientId, companyId });
}

module.exports = { create, findAll, findOwnedById, markRead, markAllRead, remove, clear };
