/**
 * modules/projects/projects.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for projects are finalized.
 */
const Joi = require('joi');
const objectId = Joi.string().hex().length(24);
const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

const createSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  clientName: Joi.string().trim().max(150).allow('').optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  startDate: Joi.date().iso().empty('').optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).empty('').optional(),
  status: Joi.string().valid(...statuses).default('planning'),
  projectManagerId: objectId.allow(null, '').optional(),
  teamLeadId: objectId.allow(null, '').optional(),
  teamMembers: Joi.array().items(Joi.object({
    employeeId: objectId.required(),
    projectRole: Joi.string().trim().max(100).allow('').optional(),
    allocatedHours: Joi.number().min(0).default(0),
  })).unique('employeeId').default([]),
  billableHours: Joi.number().min(0).default(0),
  incentivePool: Joi.number().min(0).default(0),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

const idParamsSchema = Joi.object({ id: objectId.required() });

module.exports = { createSchema, updateSchema, idParamsSchema };
