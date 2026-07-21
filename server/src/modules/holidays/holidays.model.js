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
    eventType: {
      type: String,
      enum: ['full_day', 'half_day', 'early_closure', 'late_opening'],
      default: 'full_day',
    },
    effectiveTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    requiredMinutesOverride: { type: Number, min: 0, max: 1440 },
    affectedScope: { type: String, enum: ['all', 'department', 'shift'], default: 'all' },
    affectedDepartment: { type: String, trim: true, maxlength: 100 },
    affectedShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    isPaid: { type: Boolean, default: true },
    attendanceAdjustedAt: Date,
    attendanceAdjustedCount: { type: Number, default: 0 },
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
