/**
 * modules/expenses/expenses.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for expenses are finalized.
 */
const Joi = require('joi');

const createSchema = Joi.object({
  category: Joi.string().trim().min(2).max(100).required(),
  vendorName: Joi.string().trim().min(2).max(150).required(),
  invoiceUrl: Joi.string().trim().uri({ allowRelative: true }).max(1000).allow('').default(''),
  amount: Joi.number().positive().precision(2).required(),
  paymentMethod: Joi.string().valid('Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Online').required(),
  expenseDate: Joi.date().iso().max('now').required(),
  remarks: Joi.string().trim().max(1000).allow('').default(''),
});

module.exports = { createSchema };
