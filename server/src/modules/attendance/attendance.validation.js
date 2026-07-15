/**
 * modules/attendance/attendance.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for attendance are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  employeeId: Joi.any(),
  date: Joi.any(),
  signInTime: Joi.any(),
  signOutTime: Joi.any(),
  status: Joi.any(),
  lateMinutes: Joi.any(),
  method: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
