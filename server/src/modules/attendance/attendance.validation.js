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
  employeeId: objectId.empty('').optional(),
});

const rangeSummaryQuerySchema = Joi.object({
  employeeId: objectId.empty('').optional(),
  dateFrom: Joi.date().iso().required(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).required(),
}).custom((value, helpers) => {
  const days = (new Date(value.dateTo) - new Date(value.dateFrom)) / 86400000;
  if (days > 366) return helpers.message({ custom: 'Attendance report range cannot exceed 366 days.' });
  return value;
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
  sort: Joi.string().valid('date', '-date', 'createdAt', '-createdAt').default('-date'),
  employeeId: objectId.empty('').optional(),
  status: Joi.string().valid(...statuses).empty('').optional(),
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
  // Overnight shifts legitimately sign out on the next calendar day even
  // when the displayed clock time is lower. The service validates the fully
  // resolved fixed dates and returns a clear business error when needed.
  signOutTime: Joi.date().iso().optional(),
  status: Joi.string().valid(...statuses).optional(),
  notes: Joi.string().trim().max(500).allow('').optional(),
}).custom((value, helpers) => {
  if (value.signInTime && value.signOutTime
      && new Date(value.signOutTime) <= new Date(value.signInTime)) {
    return helpers.message({ custom: 'Sign-out must be after sign-in. Overnight shifts use the next fixed calendar day automatically.' });
  }
  return value;
}).min(1);

const regularizationRequestSchema = Joi.object({
  requestType: Joi.string().valid('late_waiver', 'time_correction').required(),
  reason: Joi.string().trim().min(5).max(500).required(),
  requestedSignInTime: Joi.date().iso().optional(),
  requestedSignOutTime: Joi.date().iso().optional(),
}).custom((value, helpers) => {
  if (value.requestType === 'time_correction' && !value.requestedSignInTime && !value.requestedSignOutTime) {
    return helpers.message({ custom: 'A requested sign-in or sign-out time is required for a time correction.' });
  }
  if (value.requestedSignInTime && value.requestedSignOutTime
      && new Date(value.requestedSignOutTime) <= new Date(value.requestedSignInTime)) {
    return helpers.message({ custom: 'Requested sign-out time must be after sign-in time.' });
  }
  return value;
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
  rangeSummaryQuerySchema,
  listQuerySchema,
  manualCorrectionSchema,
  regularizationRequestSchema,
  regularizationReviewSchema,
};
