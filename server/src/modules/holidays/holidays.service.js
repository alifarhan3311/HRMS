const createHttpError = require('http-errors');
const Holiday = require('./holidays.model');
const Employee = require('../employees/employees.model');
const CompanySettings = require('../companySettings/companySettings.model');
const notificationService = require('../notifications/notifications.service');
const { sendCompanyMail } = require('../../config/mailer');
const { canadaHolidays } = require('./canadaHolidays');

const HR_ROLES = ['hr', 'super_admin'];
const dateKey = date => new Date(date).toISOString().slice(0, 10);
const normalizeHolidayDate = value => {
  const [year, month, day] = dateKey(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};
const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);

async function listHolidays(query, actor) {
  const filter = { companyId: actor.companyId };
  if (query.year) filter.date = {
    $gte: new Date(Date.UTC(Number(query.year), 0, 1)),
    $lte: new Date(Date.UTC(Number(query.year), 11, 31, 23, 59, 59)),
  };
  if (!HR_ROLES.includes(actor.role)) filter.status = 'confirmed';
  else if (query.status) filter.status = query.status;
  return Holiday.find(filter).sort('date').lean();
}

async function notifyHrOfCandidate(holiday, companyId) {
  const hrUsers = await Employee.find({ companyId, role: { $in: HR_ROLES }, status: 'active' }).select('_id');
  await Promise.allSettled(hrUsers.map(user => notificationService.createNotification({
    recipientId: user._id,
    companyId,
    type: 'holiday',
    title: 'Holiday confirmation required',
    message: `${holiday.title} (${dateKey(holiday.date)}) is on the Canada calendar. Confirm whether the company will be off.`,
    link: '/settings?tab=holidays',
    metadata: { holidayId: holiday._id, status: 'pending_hr' },
    dedupeKey: `holiday-review:${holiday._id}:${user._id}`,
  })));
}

async function syncCanadaCalendar({ year }, actor) {
  const numericYear = Number(year) || new Date().getUTCFullYear();
  if (numericYear < 2020 || numericYear > 2100) throw createHttpError(422, 'Year must be between 2020 and 2100.');
  const settings = await CompanySettings.findOne({ companyId: actor.companyId }).lean();
  const province = settings?.holidayPolicy?.province || 'ON';
  const candidates = canadaHolidays(numericYear, province);
  let created = 0;

  for (const candidate of candidates) {
    let holiday = await Holiday.findOne({ companyId: actor.companyId, date: candidate.date });
    if (!holiday) {
      holiday = await Holiday.create({ ...candidate, companyId: actor.companyId, source: 'canada_calendar', status: 'pending_hr' });
      created += 1;
      await notifyHrOfCandidate(holiday, actor.companyId);
    }
  }
  return { year: numericYear, province, created, total: candidates.length };
}

async function createHoliday(payload, actor) {
  const date = normalizeHolidayDate(payload.date);
  const exists = await Holiday.findOne({ companyId: actor.companyId, date });
  if (exists) throw createHttpError(409, 'A holiday already exists on this date.');
  const holiday = await Holiday.create({ ...payload, date, companyId: actor.companyId, country: 'PK', source: 'manual', jurisdiction: 'company', status: 'pending_hr' });
  await notifyHrOfCandidate(holiday, actor.companyId);
  return holiday;
}

async function createManualCompanyOff(payload, actor) {
  const date = normalizeHolidayDate(payload.date);
  const exists = await Holiday.findOne({ companyId: actor.companyId, date });
  if (exists) throw createHttpError(409, 'A holiday already exists on this date.');
  const holiday = await Holiday.create({
    ...payload,
    date,
    companyId: actor.companyId,
    country: 'PK',
    source: 'manual',
    jurisdiction: 'company',
    status: 'pending_hr',
  });
  return decideHoliday(holiday._id, {
    isCompanyOff: true,
    note: payload.description || 'Manually declared company off by HR.',
  }, actor);
}

async function updateHoliday(id, payload, actor) {
  const updated = await Holiday.findOneAndUpdate({ _id: id, companyId: actor.companyId }, { $set: payload }, { new: true, runValidators: true });
  if (!updated) throw createHttpError(404, 'Holiday not found.');
  return updated;
}

async function decideHoliday(id, payload, actor) {
  const existing = await Holiday.findOne({ _id: id, companyId: actor.companyId });
  if (!existing) throw createHttpError(404, 'Holiday not found.');
  if (payload.isCompanyOff && existing.status === 'confirmed' && existing.employeeEmailSentAt) {
    throw createHttpError(409, 'This holiday is already confirmed. Employee emails were not sent again.');
  }
  const status = payload.isCompanyOff ? 'confirmed' : 'rejected';
  const holiday = await Holiday.findOneAndUpdate(
    { _id: id, companyId: actor.companyId },
    { $set: { status, decidedBy: actor.id, decidedAt: new Date(), decisionNote: payload.note || '' } },
    { new: true }
  );
  if (!payload.isCompanyOff) return { holiday, notified: 0, emailed: 0, emailFailed: 0 };

  const employees = await Employee.find({ companyId: actor.companyId, status: 'active' }).select('_id fullName email');
  const subject = `Company Holiday: ${holiday.title} - ${dateKey(holiday.date)}`;
  const detail = holiday.description || payload.note || '';
  const notificationResults = await Promise.allSettled(employees.map(employee => notificationService.createNotification({
    recipientId: employee._id,
    companyId: actor.companyId,
    type: 'holiday',
    title: `Company off: ${holiday.title}`,
    message: `${holiday.title} on ${dateKey(holiday.date)} has been confirmed as a company holiday by HR.${detail ? ` ${detail}` : ''}`,
    link: '/dashboard',
    metadata: { holidayId: holiday._id, status: 'confirmed' },
    dedupeKey: `holiday-confirmed:${holiday._id}:${employee._id}`,
  })));
  const deliveredIds = new Set((existing.emailDeliveredTo || []).map(String));
  const emailTargets = employees.filter(employee => employee.email && !deliveredIds.has(String(employee._id)));
  const emailResults = await Promise.allSettled(emailTargets.map(employee => sendCompanyMail(actor.companyId, {
    to: employee.email,
    subject,
    html: `<p>Hello ${escapeHtml(employee.fullName)},</p><p>HR has confirmed <strong>${escapeHtml(holiday.title)}</strong> on <strong>${dateKey(holiday.date)}</strong> as a company holiday.</p>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}<p>The company will be closed on this date.</p><p>Regards,<br>HR Team</p>`,
  })));
  const emailed = emailResults.filter(result => result.status === 'fulfilled').length;
  emailResults.forEach((result, index) => {
    if (result.status === 'fulfilled') deliveredIds.add(String(emailTargets[index]._id));
  });
  holiday.emailDeliveredTo = [...deliveredIds];
  holiday.employeeEmailFailedCount = emailResults.length - emailed;
  const emailRecipientCount = employees.filter(employee => employee.email).length;
  holiday.employeeEmailSentAt = deliveredIds.size >= emailRecipientCount ? new Date() : undefined;
  await holiday.save();
  return {
    holiday,
    notified: notificationResults.filter(result => result.status === 'fulfilled').length,
    emailed,
    emailFailed: holiday.employeeEmailFailedCount,
  };
}

async function deleteHoliday(id, actor) {
  const deleted = await Holiday.findOneAndDelete({ _id: id, companyId: actor.companyId });
  if (!deleted) throw createHttpError(404, 'Holiday not found.');
  return { message: 'Holiday deleted.' };
}

module.exports = { listHolidays, syncCanadaCalendar, createHoliday, createManualCompanyOff, updateHoliday, decideHoliday, deleteHoliday };
