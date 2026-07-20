/**
 * modules/employees/employees.model.js
 * Mongoose schema for Employee. Field-level encryption is applied via
 * set/get transforms on sensitive fields, so callers work with plaintext
 * in application code while ciphertext is what's persisted/read from disk.
 * NOTE: reading encrypted getters requires { toJSON:{getters:true}, toObject:{getters:true} }.
 */
const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../../utils/crypto');

const employeesSchema = new mongoose.Schema(
  {
  employeeCode: { type: String, required: true, unique: true, immutable: true },
  fullName: { type: String, required: true },
  fatherName: { type: String },
  cnic: { type: String, required: true, set: encryptField, get: decryptField },
  dateOfBirth: { type: Date },
  gender: { type: String },
  maritalStatus: { type: String },
  bloodGroup: { type: String },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String, set: encryptField, get: decryptField },
  address: { type: String, set: encryptField, get: decryptField },
  joiningDate: { type: Date, required: true },
  department: { type: String },
  designation: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  currentSalary: { type: String, set: encryptField, get: decryptField },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'resigned'],
    default: 'active',
  },
  profilePicture: { type: String },
  emergencyContact: { type: String, set: encryptField, get: decryptField },
  skills: { type: [String], default: [] },
  qualification: { type: String },
  experience: { type: String },
  salaryHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  lastIncrementAmount: { type: Number },
  lastIncrementDate: { type: Date },
  leaveBalance: {
    paid: { available: { type: Number, default: 12 }, used: { type: Number, default: 0 } },
    casual: { available: { type: Number, default: 10 }, used: { type: Number, default: 0 } },
    sick: { available: { type: Number, default: 8 }, used: { type: Number, default: 0 } },
    annual: { available: { type: Number, default: 14 }, used: { type: Number, default: 0 } },
  },
  leaveCycle: {
    basis: { type: String, enum: ['calendar_year'] },
    lastProcessedYear: Number,
    lastProcessedAt: Date,
    nextResetDate: Date,
    // Legacy field retained so old documents can be migrated safely.
    nextAnniversary: Date,
    carriedForward: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  lateCount: { type: Number, default: 0 },
  role: {
    type: String,
    enum: ['employee', 'team_lead', 'manager', 'hr', 'admin', 'super_admin'],
    required: true,
  },
  // Card details
  employeeCardNumber: { type: String, immutable: true },
  insuranceCardNumber: { type: String },

  // Exit / resignation
  exitDate: { type: Date },
  exitReason: { type: String },

  // Promotion history
  promotionHistory: {
    type: [
      {
        designation: String,
        department: String,
        role: String,
        currentSalary: String,
        incrementAmount: Number,
        effectiveDate: Date,
        remarks: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },

  passwordHash: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

employeesSchema.index({ companyId: 1 });
employeesSchema.index(
  { employeeCardNumber: 1 },
  { unique: true, partialFilterExpression: { employeeCardNumber: { $gt: '' } } }
);

module.exports = mongoose.model('Employee', employeesSchema);
