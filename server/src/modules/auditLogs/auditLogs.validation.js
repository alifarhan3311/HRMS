const Joi = require('joi');

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
  companyId: Joi.string().hex().length(24).optional(),
  userId: Joi.string().hex().length(24).optional(),
  action: Joi.string().trim().max(100).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
});

module.exports = { listQuerySchema };
