/**
 * Joi schemas for attendance request bodies, query strings, and route params.
 */
const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const statuses = ['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend'];

const idParamsSchema = Joi.object({
  id: objectId.required(),
});

const signInSchema = Joi.object({
  method: Joi.string().valid('manual', 'qr', 'face', 'biometric').default('manual'),
  notes: Joi.string().trim().max(500).allow('').optional(),
});

const signOutSchema = Joi.object({
  notes: Joi.string().trim().max(500).allow('').optional(),
});

const monthlySummaryQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  employeeId: objectId.optional(),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
  sort: Joi.string().valid('date', '-date', 'createdAt', '-createdAt').default('-date'),
  employeeId: objectId.optional(),
  status: Joi.string().valid(...statuses).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2000).max(2100).when('month', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const manualCorrectionSchema = Joi.object({
  signInTime: Joi.date().iso().optional(),
  signOutTime: Joi.when('signInTime', {
    is: Joi.exist(),
    then: Joi.date().iso().min(Joi.ref('signInTime')),
    otherwise: Joi.date().iso(),
  }).optional(),
  status: Joi.string().valid(...statuses).optional(),
  notes: Joi.string().trim().max(500).allow('').optional(),
}).min(1);

const regularizationRequestSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required(),
});

const regularizationReviewSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  remarks: Joi.string().trim().max(500).allow('').optional(),
});

module.exports = {
  idParamsSchema,
  signInSchema,
  signOutSchema,
  monthlySummaryQuerySchema,
  listQuerySchema,
  manualCorrectionSchema,
  regularizationRequestSchema,
  regularizationReviewSchema,
};
