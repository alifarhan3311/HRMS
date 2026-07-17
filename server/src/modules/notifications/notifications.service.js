const createHttpError = require('http-errors');
const repository = require('./notifications.repository');
const { emitToUser } = require('../../config/socket');

async function createNotification(data) {
  const { notification, created } = await repository.create(data);
  if (created) {
    emitToUser(data.recipientId, 'notification:new', notification.toJSON());
  }
  return notification;
}

async function listNotifications(query, actor) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const read = query.read === undefined ? undefined : query.read === true || query.read === 'true';

  return repository.findAll({
    recipientId: actor.id,
    companyId: actor.companyId,
    read,
    page,
    limit,
  });
}

async function markRead(id, actor) {
  const notification = await repository.markRead(id, actor.id, actor.companyId);
  if (!notification) throw createHttpError(404, 'Notification not found.');
  emitToUser(actor.id, 'notification:read', { id: notification.id, readAt: notification.readAt });
  return notification;
}

async function markAllRead(actor) {
  const result = await repository.markAllRead(actor.id, actor.companyId);
  emitToUser(actor.id, 'notification:read-all', { readAt: new Date().toISOString() });
  return { updated: result.modifiedCount };
}

async function removeNotification(id, actor) {
  const notification = await repository.remove(id, actor.id, actor.companyId);
  if (!notification) throw createHttpError(404, 'Notification not found.');
  emitToUser(actor.id, 'notification:deleted', { id: notification.id });
  return { message: 'Notification deleted.' };
}

async function clearNotifications(actor) {
  const result = await repository.clear(actor.id, actor.companyId);
  emitToUser(actor.id, 'notification:cleared', {});
  return { deleted: result.deletedCount };
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
  removeNotification,
  clearNotifications,
};
