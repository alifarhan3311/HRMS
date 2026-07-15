/**
 * modules/payroll/payroll.model.js
 * Payslip with full salary breakdown, approval workflow, and encryption.
 */
const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../../utils/crypto');

const allowanceItemSchema = new mongoose.Schema({
  label: { type: String }, amount: { type: Number, default: 0 },
}, { _id: false });

const deductionItemSchema = new mongoose.Schema({
  label: { type: String }, amount: { type: Number, default: 0 },
}, { _id: false });

const payrollSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    // Core salary (encrypted)
    basicSalary:  { type: String, required: true, set: encryptField, get: decryptField },
    netSalary:    { type: String, required: true, set: encryptField, get: decryptField },
    grossSalary:  { type: String, set: encryptField, get: decryptField },
    // Breakdown (plain numbers, not individually sensitive when isolated)
    allowanceItems:  { type: [allowanceItemSchema], default: [] },
    deductionItems:  { type: [deductionItemSchema], default: [] },
    allowances:  { type: Number, default: 0 },
    deductions:  { type: Number, default: 0 },
    bonus:       { type: Number, default: 0 },
    incentives:  { type: Number, default: 0 },
    overtime:    { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    advanceSalary: { type: Number, default: 0 },
    taxDeduction:  { type: Number, default: 0 },
    // Meta
    presentDays:  { type: Number, default: 0 },
    absentDays:   { type: Number, default: 0 },
    lateDays:     { type: Number, default: 0 },
    workingDays:  { type: Number, default: 0 },
    // Workflow
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'paid', 'locked'],
      default: 'draft',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    approvedAt: { type: Date },
    paidAt:     { type: Date },
    notes:      { type: String },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

payrollSchema.index({ companyId: 1, month: 1, year: 1 });
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payslip', payrollSchema);
