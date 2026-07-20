const Joi = require('joi');

const createSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).required(),
  date: Joi.date().iso().required(),
  description: Joi.string().trim().max(500).allow('').optional(),
  isRecurring: Joi.boolean().default(false),
});

const updateSchema = createSchema.fork(['title', 'date'], schema => schema.optional()).min(1);
const decisionSchema = Joi.object({
  isCompanyOff: Joi.boolean().required(),
  note: Joi.string().trim().max(500).allow('').optional(),
});
const syncSchema = Joi.object({ year: Joi.number().integer().min(2020).max(2100).required() });

module.exports = { createSchema, updateSchema, decisionSchema, syncSchema };
