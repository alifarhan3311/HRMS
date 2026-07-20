/**
 * config/mailer.js
 * Nodemailer transport for system emails (leave approvals, payslips,
 * offer letters, welcome emails). SMTP settings are configurable per
 * company via the company-settings module rather than hardcoded here.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const CompanySettings = require('../modules/companySettings/companySettings.model');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html }) {
  try {
    return await transporter.sendMail({
      from: process.env.SMTP_FROM || '"HRMS" <no-reply@hrms.local>',
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error('[mailer] Failed to send email', { to, subject, error: err.message });
    throw err;
  }
}

async function sendCompanyMail(companyId, { to, subject, html }) {
  const settings = await CompanySettings.findOne({ companyId });
  const smtp = settings?.smtp;
  const companyTransporter = smtp?.host && smtp?.user && smtp?.password
    ? nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Boolean(smtp.secure),
      auth: { user: smtp.user, pass: smtp.password },
    })
    : transporter;

  try {
    return await companyTransporter.sendMail({
      from: smtp?.from || process.env.SMTP_FROM || '"HRMS" <no-reply@hrms.local>',
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error('[mailer] Failed to send company email', { companyId, to, subject, error: err.message });
    throw err;
  }
}

module.exports = { transporter, sendMail, sendCompanyMail };
