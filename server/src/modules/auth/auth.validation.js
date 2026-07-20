/**
 * modules/auth/auth.validation.js
 * Joi request-body schemas. Wired into the route via a validate() middleware
 * (see middlewares/validate.middleware.js) — fill in precise per-field rules
 * as business requirements for auth are finalized.
 */
const Joi = require('joi');

const GENDERS = ['male', 'female', 'other'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const createSchema = Joi.object({
  employeeId: Joi.any(),
  refreshTokenHash: Joi.any(),
  userAgent: Joi.any(),
  ipAddress: Joi.any(),
  expiresAt: Joi.any(),
  revoked: Joi.any(),
});

const updateSchema = createSchema.fork(
  Object.keys(createSchema.describe().keys),
  (schema) => schema.optional()
);

const profilePictureSchema = Joi.string().max(750000).custom((value, helpers) => {
  if (!value || /^https?:\/\//i.test(value) || /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) return value;
  return helpers.message({ custom: 'Profile picture must be a valid image URL or uploaded image.' });
});

const profileUpdateSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional(),
  fatherName: Joi.string().trim().max(100).allow('').optional(),
  dateOfBirth: Joi.date().max('now').empty('').optional(),
  gender: Joi.string().valid(...GENDERS).empty('').optional(),
  maritalStatus: Joi.string().valid(...MARITAL_STATUSES).empty('').optional(),
  bloodGroup: Joi.string().valid(...BLOOD_GROUPS).empty('').optional(),
  contactNumber: Joi.string().trim().max(20).allow('').optional(),
  address: Joi.string().trim().max(500).allow('').optional(),
  emergencyContact: Joi.string().trim().max(200).allow('').optional(),
  profilePicture: profilePictureSchema.allow('').optional(),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(100).required(),
  newPassword: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'New password must contain uppercase, lowercase, and a number.',
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Password confirmation does not match.' }),
});

module.exports = { createSchema, updateSchema, profileUpdateSchema, changePasswordSchema };
