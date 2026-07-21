const Joi = require('joi');
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);

const createSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).required(),
  date: Joi.date().iso().required(),
  description: Joi.string().trim().max(500).allow('').optional(),
  isRecurring: Joi.boolean().default(false),
  eventType: Joi.string().valid('full_day', 'half_day', 'early_closure', 'late_opening').default('full_day'),
  effectiveTime: time.when('eventType', {
    is: Joi.valid('early_closure', 'late_opening'), then: Joi.required(), otherwise: Joi.optional().allow(''),
  }),
  requiredMinutesOverride: Joi.number().integer().min(0).max(1440).optional().allow(null),
  affectedScope: Joi.string().valid('all', 'department', 'shift').default('all'),
  affectedDepartment: Joi.string().trim().max(100).when('affectedScope', { is: 'department', then: Joi.required(), otherwise: Joi.optional().allow('') }),
  affectedShiftId: Joi.string().hex().length(24).when('affectedScope', { is: 'shift', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
  isPaid: Joi.boolean().default(true),
});

const updateSchema = createSchema.fork(['title', 'date'], schema => schema.optional()).min(1);
const decisionSchema = Joi.object({
  isCompanyOff: Joi.boolean().required(),
  note: Joi.string().trim().max(500).allow('').optional(),
});
const syncSchema = Joi.object({ year: Joi.number().integer().min(2020).max(2100).required() });

module.exports = { createSchema, updateSchema, decisionSchema, syncSchema };
