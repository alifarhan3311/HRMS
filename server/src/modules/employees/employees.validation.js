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
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const SALARY_PAYMENT_METHODS = [
  'allied_bank', 'askari_bank', 'bank_alfalah', 'bank_al_habib', 'bankislami',
  'bank_of_khyber', 'bank_of_punjab', 'dubai_islamic_bank', 'easypaisa',
  'faysal_bank', 'first_women_bank', 'habib_bank', 'habib_metropolitan',
  'jazzcash', 'js_bank', 'mcb_bank', 'mcb_islamic', 'meezan_bank',
  'national_bank', 'nayapay', 'sadapay', 'sindh_bank', 'soneri_bank',
  'standard_chartered', 'ubl', 'upaisa', 'zindigi', 'other',
];
const paymentMethodSchema = Joi.string().valid(...SALARY_PAYMENT_METHODS).empty('').optional();
const accountNumberSchema = Joi.string().trim().pattern(/^[A-Za-z0-9+\-\s]{5,50}$/).empty('').optional()
  .messages({ 'string.pattern.base': 'Enter a valid account, IBAN, or wallet number.' });
const accountTitleSchema = Joi.string().trim().min(2).max(100).empty('').optional();
const bloodGroupSchema = Joi.string().trim().custom((value, helpers) => {
  const normalized = value.toLowerCase();
  if (['unknown', 'not known', 'not specified', 'n/a', 'na'].includes(normalized)) {
    return 'Unknown';
  }
  const canonical = BLOOD_GROUPS.find((group) => group.toLowerCase() === normalized);
  return canonical || helpers.message({ custom: 'Blood group must be A+, A-, B+, B-, AB+, AB-, O+, O-, or Unknown.' });
}).empty('').optional();

const createSchema = Joi.object({
  // Identity
  fullName: Joi.string().trim().min(2).max(100).required(),
  fatherName: Joi.string().trim().max(100).optional().allow(''),
  cnic: Joi.string()
    .trim()
    .pattern(/^\d{5}-\d{7}-\d$/)
    .required()
    .messages({ 'string.pattern.base': 'CNIC must be in format XXXXX-XXXXXXX-X' }),
  dateOfBirth: Joi.date().max('now').empty('').optional(),
  gender: Joi.string().valid(...GENDERS).empty('').optional(),
  maritalStatus: Joi.string().valid(...MARITAL_STATUSES).empty('').optional(),
  bloodGroup: bloodGroupSchema,

  // Contact
  email: Joi.string().email().lowercase().required(),
  contactNumber: Joi.string().trim().max(20).optional().allow(''),
  address: Joi.string().trim().max(500).optional().allow(''),
  emergencyContact: Joi.string().trim().max(200).optional().allow(''),

  // Employment
  joiningDate: Joi.date().required(),
  department: Joi.string().trim().min(2).max(100).required()
    .messages({ 'string.empty': 'Department is required', 'any.required': 'Department is required' }),
  workMode: Joi.string().valid('office', 'wfh').default('office'),
  managedDepartments: Joi.array().items(Joi.string().trim().min(2).max(100)).unique().optional(),
  designation: Joi.string().trim().max(100).optional().allow(''),
  managerId: Joi.string().hex().length(24).optional().allow(null, ''),
  teamLeadId: Joi.string().hex().length(24).optional().allow(null, ''),
  shiftId: Joi.string().hex().length(24).required(),
  role: Joi.string().valid(...ROLES).required(),
  status: Joi.string().valid(...STATUSES).optional(),

  // Salary
  currentSalary: Joi.string().optional().allow(''),
  salaryPaymentMethod: paymentMethodSchema,
  salaryAccountNumber: accountNumberSchema,
  salaryAccountTitle: accountTitleSchema,

  // Professional
  skills: Joi.array().items(Joi.string().trim()).optional(),
  qualification: Joi.string().trim().max(200).optional().allow(''),
  experience: Joi.string().trim().max(500).optional().allow(''),

  // Cards
  insuranceCardNumber: Joi.string().trim().max(50).optional().allow(''),
  biometricDeviceUserId: Joi.string().trim().max(32).pattern(/^[A-Za-z0-9_-]+$/).optional().allow(''),

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
  dateOfBirth: Joi.date().max('now').empty('').optional(),
  gender: Joi.string().valid(...GENDERS).empty('').optional(),
  maritalStatus: Joi.string().valid(...MARITAL_STATUSES).empty('').optional(),
  bloodGroup: bloodGroupSchema,
  contactNumber: Joi.string().trim().max(20).optional().allow(''),
  address: Joi.string().trim().max(500).optional().allow(''),
  emergencyContact: Joi.string().trim().max(200).optional().allow(''),
  department: Joi.string().trim().min(2).max(100).optional(),
  workMode: Joi.string().valid('office', 'wfh').optional(),
  managedDepartments: Joi.array().items(Joi.string().trim().min(2).max(100)).unique().optional(),
  designation: Joi.string().trim().max(100).optional().allow(''),
  managerId: Joi.string().hex().length(24).optional().allow(null, ''),
  teamLeadId: Joi.string().hex().length(24).optional().allow(null, ''),
  shiftId: Joi.string().hex().length(24).optional().allow(null, ''),
  skills: Joi.array().items(Joi.string().trim()).optional(),
  qualification: Joi.string().trim().max(200).optional().allow(''),
  experience: Joi.string().trim().max(500).optional().allow(''),
  insuranceCardNumber: Joi.string().trim().max(50).optional().allow(''),
  biometricDeviceUserId: Joi.string().trim().max(32).pattern(/^[A-Za-z0-9_-]+$/).optional().allow(''),
  salaryPaymentMethod: paymentMethodSchema,
  salaryAccountNumber: accountNumberSchema,
  salaryAccountTitle: accountTitleSchema,
  profilePicture: Joi.string().uri().optional().allow(''),
}).and('salaryPaymentMethod', 'salaryAccountNumber', 'salaryAccountTitle').min(1);

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

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and a number.',
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Password confirmation does not match.' }),
});

const departmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Department name is required.',
      'string.min': 'Department name must contain at least 2 characters.',
    }),
}).and('salaryPaymentMethod', 'salaryAccountNumber', 'salaryAccountTitle');

const leaveBalanceInitializationSchema = Joi.object({
  mode: Joi.string().valid('full_year', 'prorated', 'manual').required(),
  effectiveDate: Joi.date().required(),
  reason: Joi.string().trim().min(3).max(500).required(),
  balances: Joi.object({
    annual: Joi.object({
      entitlement: Joi.number().min(0).max(365).required(),
      used: Joi.number().min(0).max(365).required(),
    }).required(),
    sick: Joi.object({
      entitlement: Joi.number().min(0).max(365).required(),
      used: Joi.number().min(0).max(365).required(),
    }).required(),
  }).required(),
  confirmAdjustment: Joi.boolean().default(false),
});

module.exports = {
  createSchema,
  updateSchema,
  statusSchema,
  promotionSchema,
  resetPasswordSchema,
  departmentSchema,
  leaveBalanceInitializationSchema,
};
