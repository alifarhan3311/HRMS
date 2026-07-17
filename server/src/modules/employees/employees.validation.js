/**
 * modules/employees/employees.validation.js
 * Strict Joi schemas for employee create / update / status-change / promotion.
 * All fields validated with proper types, lengths, and regex patterns.
 */
const Joi = require('joi');

const ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin', 'super_admin'];
const STATUSES = ['active', 'inactive', 'on_leave', 'resigned'];
const GENDERS = ['male', 'female', 'other'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const createSchema = Joi.object({
  // Identity
  employeeCode: Joi.string().trim().max(20).required(),
  fullName: Joi.string().trim().min(2).max(100).required(),
  fatherName: Joi.string().trim().max(100).optional().allow(''),
  cnic: Joi.string()
    .trim()
    .pattern(/^\d{5}-\d{7}-\d$/)
    .required()
    .messages({ 'string.pattern.base': 'CNIC must be in format XXXXX-XXXXXXX-X' }),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid(...GENDERS).optional(),
  maritalStatus: Joi.string().valid(...MARITAL_STATUSES).optional(),
  bloodGroup: Joi.string().valid(...BLOOD_GROUPS).optional(),

  // Contact
  email: Joi.string().email().lowercase().required(),
  contactNumber: Joi.string().trim().max(20).optional().allow(''),
  address: Joi.string().trim().max(500).optional().allow(''),
  emergencyContact: Joi.string().trim().max(200).optional().allow(''),

  // Employment
  joiningDate: Joi.date().required(),
  department: Joi.string().trim().max(100).optional().allow(''),
  designation: Joi.string().trim().max(100).optional().allow(''),
  managerId: Joi.string().hex().length(24).optional().allow(null, ''),
  teamLeadId: Joi.string().hex().length(24).optional().allow(null, ''),
  role: Joi.string().valid(...ROLES).required(),
  status: Joi.string().valid(...STATUSES).optional(),

  // Salary
  currentSalary: Joi.string().optional().allow(''),

  // Professional
  skills: Joi.array().items(Joi.string().trim()).optional(),
  qualification: Joi.string().trim().max(200).optional().allow(''),
  experience: Joi.string().trim().max(500).optional().allow(''),

  // Cards
  employeeCardNumber: Joi.string().trim().max(50).optional().allow(''),
  insuranceCardNumber: Joi.string().trim().max(50).optional().allow(''),

  // Initial password (for account creation)
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and a number.',
    }),
});

const updateSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional(),
  fatherName: Joi.string().trim().max(100).optional().allow(''),
  cnic: Joi.string().trim().pattern(/^\d{5}-\d{7}-\d$/).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid(...GENDERS).optional(),
  maritalStatus: Joi.string().valid(...MARITAL_STATUSES).optional(),
  bloodGroup: Joi.string().valid(...BLOOD_GROUPS).optional(),
  contactNumber: Joi.string().trim().max(20).optional().allow(''),
  address: Joi.string().trim().max(500).optional().allow(''),
  emergencyContact: Joi.string().trim().max(200).optional().allow(''),
  department: Joi.string().trim().max(100).optional().allow(''),
  designation: Joi.string().trim().max(100).optional().allow(''),
  managerId: Joi.string().hex().length(24).optional().allow(null, ''),
  teamLeadId: Joi.string().hex().length(24).optional().allow(null, ''),
  skills: Joi.array().items(Joi.string().trim()).optional(),
  qualification: Joi.string().trim().max(200).optional().allow(''),
  experience: Joi.string().trim().max(500).optional().allow(''),
  employeeCardNumber: Joi.string().trim().max(50).optional().allow(''),
  insuranceCardNumber: Joi.string().trim().max(50).optional().allow(''),
  profilePicture: Joi.string().uri().optional().allow(''),
}).min(1);

const statusSchema = Joi.object({
  status: Joi.string().valid(...STATUSES).required(),
  reason: Joi.string().trim().max(500).optional().allow(''),
});

const promotionSchema = Joi.object({
  designation: Joi.string().trim().max(100).required(),
  department: Joi.string().trim().max(100).optional(),
  role: Joi.string().valid(...ROLES).optional(),
  currentSalary: Joi.string().optional(),
  incrementAmount: Joi.number().min(0).optional(),
  effectiveDate: Joi.date().required(),
  remarks: Joi.string().trim().max(500).optional().allow(''),
});

module.exports = { createSchema, updateSchema, statusSchema, promotionSchema };
