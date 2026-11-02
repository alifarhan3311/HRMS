const mongoose = require('mongoose');

// Private recovery records. Snapshots retain the original encrypted values;
// this collection is never exposed by the employee-facing payroll endpoints.
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  payslipId: { type: mongoose.Schema.Types.ObjectId, required: true },
  clearedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  clearedAt: { type: Date, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

schema.index({ companyId: 1, year: 1, month: 1, clearedAt: -1 });

module.exports = mongoose.model('PayrollArchive', schema);
