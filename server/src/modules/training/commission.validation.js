const Joi = require('joi');
const createHttpError = require('http-errors');

const schemas = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    amount: Joi.number().min(0).required(),
    unit: Joi.string().valid('PKR', 'percent').required(),
  }),
  update: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    amount: Joi.number().min(0).required(),
    unit: Joi.string().valid('PKR', 'percent').required(),
    revision: Joi.number().integer().min(1).required(),
  }),
  delete: Joi.object({ revision: Joi.number().integer().min(1).required() }),
};

function validateCommission(input, action) {
  const { error, value } = schemas[action].required().validate(input, { abortEarly: true, convert: true });
  if (error) throw createHttpError(400, error.details[0].message);
  if (action !== 'delete') {
    value.slug = value.name.toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  return value;
}

module.exports = { validateCommission };
