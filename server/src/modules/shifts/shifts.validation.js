const Joi = require('joi');
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);

const createSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(20).required(),
  startTime: time.required(),
  endTime: time.required().invalid(Joi.ref('startTime')),
  graceMinutes: Joi.number().integer().min(0).max(180).default(15),
  workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).unique().min(1).required(),
  isActive: Joi.boolean().default(true),
});

const updateSchema = createSchema.fork(
  ['name', 'code', 'startTime', 'endTime', 'workingDays'],
  schema => schema.optional()
).min(1);

module.exports = { createSchema, updateSchema };
