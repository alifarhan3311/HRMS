const mongoose = require('mongoose');

// Kept separately from payslips so clearing a test payroll does not erase HR's
// monthly allowance decision. Zero means no allowance for that month.
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2000, max: 2100 },
  amount: { type: Number, required: true, min: 0, max: 100000000 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
}, { timestamps: true });
schema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollAllowance', schema);
