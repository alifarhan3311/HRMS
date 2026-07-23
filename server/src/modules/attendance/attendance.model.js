/**
 * modules/attendance/attendance.model.js
 * Attendance record — one document per employee per day.
 */
const mongoose = require('mongoose');

const regularizationSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  requestType: {
    type: String,
    enum: ['late_waiver', 'time_correction'],
    default: 'time_correction',
  },
  reason: { type: String },
  requestedAt: { type: Date, default: Date.now },
  requestedSignInTime: { type: Date },
  requestedSignOutTime: { type: Date },
  assignedApprover: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  reviewedAt: { type: Date },
  remarks: { type: String },
}, { _id: false });

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String },
    employeeCode: { type: String },
    date: { type: Date, required: true },
    shiftDate: { type: String },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    shiftName: { type: String },
    employeeDepartment: { type: String },
    shiftType: { type: String, enum: ['fixed', 'flexible'], default: 'fixed' },
    shiftStartTime: { type: String },
    shiftEndTime: { type: String },
    shiftGraceMinutes: { type: Number },
    shiftLateHalfDayAfterMinutes: { type: Number },
    shiftRequiredMinutes: { type: Number },
    shiftBreakMinutes: { type: Number },
    shiftHalfDayMinutes: { type: Number },
    shiftOvertimeAfterMinutes: { type: Number },
    effectiveRequiredMinutes: { type: Number },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    shiftTimezone: { type: String },
    signInTime: { type: Date },
    signOutTime: { type: Date },
    totalHours: { type: Number, default: 0 }, // calculated on signout
    workedMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend'],
      default: 'present',
    },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    missedPunchType: { type: String, enum: ['sign_in', 'sign_out'] },
    lateCountAppliedAt: { type: Date },
    closureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Holiday' },
    closureType: { type: String, enum: ['full_day', 'half_day', 'early_closure', 'late_opening'] },
    attendanceAdjustmentReason: { type: String },
    method: {
      type: String,
      enum: ['manual', 'qr', 'face', 'biometric'],
      default: 'manual',
    },
    // Regularization / correction request
    regularizationStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    regularization: regularizationSchema,
    leaveApplicationReminderSentAt: { type: Date },
    notes: { type: String },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// Composite unique index: one record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index(
  { employeeId: 1, shiftDate: 1 },
  { unique: true, partialFilterExpression: { shiftDate: { $type: 'string' } } }
);
attendanceSchema.index({ companyId: 1, date: 1 });
attendanceSchema.index({ companyId: 1, employeeId: 1, date: -1 });
attendanceSchema.index({ companyId: 1, status: 1, date: -1 });
attendanceSchema.index({ employeeId: 1, status: 1 });
attendanceSchema.index({ employeeId: 1, signOutTime: 1, signInTime: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
