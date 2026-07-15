/**
 * modules/auth/auth.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for auth are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  employeeId: Joi.any(),
  refreshTokenHash: Joi.any(),
  userAgent: Joi.any(),
  ipAddress: Joi.any(),
  expiresAt: Joi.any(),
  revoked: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
