const Joi = require('joi');

const categoryIdSchema = Joi.object({
  categoryId: Joi.string().hex().length(24).required(),
});

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('').default(''),
  active: Joi.boolean().default(true),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  active: Joi.boolean().optional(),
}).min(1);

module.exports = { categoryIdSchema, createCategorySchema, updateCategorySchema };
