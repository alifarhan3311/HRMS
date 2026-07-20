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
    country: { type: String, default: 'CA' },
    province: { type: String, default: 'ON' },
    source: { type: String, enum: ['canada_calendar', 'manual'], default: 'manual' },
    jurisdiction: { type: String, enum: ['federal', 'provincial', 'company'], default: 'company' },
    status: {
      type: String,
      enum: ['pending_hr', 'confirmed', 'rejected'],
      default: 'pending_hr',
      index: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    decidedAt: Date,
    decisionNote: { type: String, maxlength: 500 },
    employeeEmailSentAt: Date,
    emailDeliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    employeeEmailFailedCount: { type: Number, default: 0 },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  { timestamps: true }
);

holidaysSchema.index({ companyId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaysSchema);
