/**
 * modules/holidays/holidays.model.js
 * Public holiday calendar — managed from Company Settings / HR module.
 */
const mongoose = require('mongoose');

const holidaysSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String },
    isRecurring: { type: Boolean, default: false },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  { timestamps: true }
);

holidaysSchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.model('Holiday', holidaysSchema);
