/**
 * config/mailer.js
 * Nodemailer transport for system emails (leave approvals, payslips,
 * offer letters, welcome emails). SMTP settings are configurable per
 * company via the company-settings module rather than hardcoded here.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

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

module.exports = { transporter, sendMail };
