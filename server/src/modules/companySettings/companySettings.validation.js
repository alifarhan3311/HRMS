const Joi = require('joi');

const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const balanceTypes = ['paid', 'casual', 'sick', 'annual'];
const leaveTypes = [...balanceTypes, 'maternity', 'paternity', 'unpaid'];
const entitlementSchema = Joi.object(Object.fromEntries(
  balanceTypes.map((type) => [type, Joi.number().integer().min(0).max(365).required()])
));

const updateSchema = Joi.object({
  company: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    logoUrl: Joi.string().uri().allow('').optional(),
    website: Joi.string().uri().allow('').optional(),
    industry: Joi.string().trim().max(100).allow('').optional(),
    address: Joi.string().trim().max(500).allow('').optional(),
    timezone: Joi.string().trim().max(100).required(),
  }).optional(),
  holidayPolicy: Joi.object({
    country: Joi.string().valid('CA').required(),
    province: Joi.string().valid('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT').required(),
  }).optional(),
  timing: Joi.object({
    officeStart: time.required(),
    officeEnd: time.required(),
    graceMinutes: Joi.number().integer().min(0).max(180).required(),
    weekendDays: Joi.array().items(Joi.number().integer().min(0).max(6)).unique().required(),
  }).optional(),
  leavePolicy: Joi.object({
    enabledTypes: Joi.array().items(Joi.string().valid(...leaveTypes)).unique().min(1).required(),
    entitlements: entitlementSchema.required(),
    carryForwardTypes: Joi.array().items(Joi.string().valid(...balanceTypes)).unique().required(),
    maxCarryForward: entitlementSchema.required(),
    delayedApplicationReminderDays: Joi.number().integer().min(1).max(30).required(),
  }).optional(),
  notifications: Joi.object({
    inAppEnabled: Joi.boolean().required(),
    emailEnabled: Joi.boolean().required(),
    whatsappEnabled: Joi.boolean().required(),
  }).optional(),
  smtp: Joi.object({
    host: Joi.string().trim().max(255).allow('').optional(),
    port: Joi.number().integer().min(1).max(65535).required(),
    secure: Joi.boolean().required(),
    user: Joi.string().trim().max(255).allow('').optional(),
    password: Joi.string().max(255).allow('').optional(),
    from: Joi.string().trim().max(255).allow('').optional(),
  }).optional(),
  security: Joi.object({
    sessionTimeoutMinutes: Joi.number().integer().min(5).max(10080).required(),
    maxLoginAttempts: Joi.number().integer().min(1).max(100).required(),
    passwordExpiryDays: Joi.number().integer().min(0).max(3650).required(),
    mfaEnabled: Joi.boolean().required(),
  }).optional(),
}).min(1);

module.exports = { updateSchema };
