/**
 * config/bullmq.js
 * Queue definitions for background jobs: payroll processing, email/WhatsApp
 * notifications, report generation. Workers are registered per-module as
 * those modules are built out (e.g. modules/payroll/payroll.worker.js).
 */
const { Queue } = require('bullmq');
const redisClient = require('./redis');

const connection = redisClient;

const notificationQueue = new Queue('notifications', { connection });
const payrollQueue = new Queue('payroll-processing', { connection });
const reportQueue = new Queue('report-generation', { connection });

module.exports = { notificationQueue, payrollQueue, reportQueue };
