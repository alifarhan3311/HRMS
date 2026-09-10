/**
 * modules/fines/fine.model.js
 * Tracks HR-issued fines against employees.
 * Each fine records who was fined, the amount, the reason,
 * which HR officer raised it, and when it was issued.
 */
const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Fine amount must be at least 1.'],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Reason must be at most 1000 characters.'],
    },
    // Optional: link fine to a payroll month so it can be auto-deducted
    payrollMonth: { type: Number, min: 1, max: 12 },
    payrollYear:  { type: Number },
    // Soft-delete / void support
    voidedAt:  { type: Date },
    voidedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
);

fineSchema.index({ companyId: 1, createdAt: -1 });
fineSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('Fine', fineSchema);
