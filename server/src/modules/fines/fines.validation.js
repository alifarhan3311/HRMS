/**
 * modules/fines/fines.validation.js
 */
const Joi = require('joi');

const createFineSchema = Joi.object({
  employeeId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Employee is required.',
    'string.length': 'Invalid employee ID.',
  }),
  amount: Joi.number().min(1).required().messages({
    'any.required': 'Fine amount is required.',
    'number.min': 'Amount must be at least 1.',
  }),
  reason: Joi.string().trim().min(3).max(1000).required().messages({
    'any.required': 'Reason is required.',
    'string.min': 'Reason must be at least 3 characters.',
  }),
  payrollMonth: Joi.number().integer().min(1).max(12).optional(),
  payrollYear: Joi.number().integer().min(2020).optional(),
});

const voidFineSchema = Joi.object({
  voidReason: Joi.string().trim().min(3).max(500).optional(),
});

const listFinesSchema = Joi.object({
  employeeId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createFineSchema, voidFineSchema, listFinesSchema };
