/**
 * modules/leaves/leaves.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for leaves are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  employeeId: Joi.any(),
  leaveType: Joi.any(),
  startDate: Joi.any(),
  endDate: Joi.any(),
  reason: Joi.any(),
  status: Joi.any(),
  approvalChain: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
