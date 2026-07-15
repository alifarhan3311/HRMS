/**
 * modules/projects/projects.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for projects are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  name: Joi.any(),
  clientName: Joi.any(),
  startDate: Joi.any(),
  endDate: Joi.any(),
  status: Joi.any(),
  teamMembers: Joi.any(),
  billableHours: Joi.any(),
  incentivePool: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
