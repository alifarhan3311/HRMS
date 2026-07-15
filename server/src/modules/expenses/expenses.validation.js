/**
 * modules/expenses/expenses.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for expenses are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  category: Joi.any(),
  vendorName: Joi.any(),
  invoiceUrl: Joi.any(),
  amount: Joi.any(),
  paymentMethod: Joi.any(),
  status: Joi.any(),
  submittedBy: Joi.any(),
  approvalChain: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

module.exports = { createSchema, updateSchema };
