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

const bulkCreateSchema = Joi.object({
  rows: Joi.array().items(Joi.object({
    expenseDate: Joi.date().iso().max('now').required(),
    productName: Joi.string().trim().min(1).max(200).required(),
    quantity: Joi.number().positive().precision(3).required(),
    unitPrice: Joi.number().positive().precision(2).required(),
  })).min(1).max(500).required(),
});

const imageCreateSchema = Joi.object({
  expenseDate: Joi.date().iso().max('now').required(),
  amount: Joi.number().positive().precision(2).required(),
});

module.exports = { createSchema, bulkCreateSchema, imageCreateSchema };
