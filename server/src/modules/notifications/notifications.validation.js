const Joi = require('joi');

const idParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  read: Joi.boolean().optional(),
});

module.exports = { idParamsSchema, listQuerySchema };
