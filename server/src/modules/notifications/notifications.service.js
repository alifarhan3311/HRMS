const createHttpError = require('http-errors');
const repository = require('./notifications.repository');
const { emitToUser } = require('../../config/socket');
const { sendCompanyMail } = require('../../config/mailer');
const Employee = require('../employees/employees.model');
const logger = require('../../utils/logger');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function applicationUrl(path = '/') {
  const configured = process.env.APP_URL || process.env.CLIENT_URL
    || String(process.env.CORS_ALLOWED_ORIGINS || '').split(',')[0]
    || 'https://mhcirclesolutions.com';
  return `${configured.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function defaultEmailHtml(notification) {
  const link = applicationUrl(notification.link || '/notifications');
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
    <h2>${escapeHtml(notification.title)}</h2>
    <p>${escapeHtml(notification.message)}</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#d99b18;color:#fff;text-decoration:none;border-radius:8px">Open HRMS</a></p>
  </div>`;
}

async function createNotification(data) {
  const { notification, created } = await repository.create(data);
  if (created) {
    emitToUser(data.recipientId, 'notification:new', notification.toJSON());
  }
  return notification;
}

async function createNotificationWithEmail(data, email = {}) {
  const notification = await createNotification(data);
  const claimed = await claimEmailDelivery(notification._id);
  if (!claimed) return notification;

  try {
    const recipient = email.recipient || await Employee.findOne({
      _id: data.recipientId,
      companyId: data.companyId,
    }).select('email').lean();
    if (!recipient?.email) {
      await finishEmailDelivery(notification._id, 'failed', 'Recipient email is not configured.');
      return notification;
    }
    await sendCompanyMail(data.companyId, {
      to: recipient.email,
      subject: email.subject || data.title,
      html: email.html || defaultEmailHtml(data),
    });
    await finishEmailDelivery(notification._id, 'sent');
  } catch (error) {
    await finishEmailDelivery(notification._id, 'failed', error.message);
    logger.error('[notifications] Workflow email delivery failed', {
      notificationId: String(notification._id),
      recipientId: String(data.recipientId),
      error: error.message,
    });
  }
  return notification;
}

async function claimEmailDelivery(notificationId) {
  return repository.claimEmailDelivery(notificationId);
}

async function finishEmailDelivery(notificationId, status, error) {
  return repository.finishEmailDelivery(notificationId, status, error);
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
  createNotificationWithEmail,
  claimEmailDelivery,
  finishEmailDelivery,
  listNotifications,
  markRead,
  markAllRead,
  removeNotification,
  clearNotifications,
};
