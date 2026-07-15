/**
 * modules/payroll/payroll.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for payroll are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  employeeId: Joi.any(),
  month: Joi.any(),
  year: Joi.any(),
  basicSalary: Joi.any(),
  allowances: Joi.any(),
  deductions: Joi.any(),
  bonus: Joi.any(),
  incentives: Joi.any(),
  netSalary: Joi.any(),
  status: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
