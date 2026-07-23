const Joi = require('joi');

const leaveTypes = ['paid', 'casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid'];

const createSchema = Joi.object({
  leaveType: Joi.string().valid(...leaveTypes).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  reason: Joi.string().trim().max(1000).allow('').default(''),
  emergencyContact: Joi.string().trim().max(200).allow('').default(''),
});

const decisionSchema = Joi.object({
  remarks: Joi.string().trim().max(500).allow('').default(''),
});

const cancelSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('').default(''),
});

module.exports = { createSchema, decisionSchema, cancelSchema };
