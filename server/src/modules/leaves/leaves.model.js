/**
 * modules/leaves/leaves.model.js
 * Leave request with multi-stage approval chain.
 * Workflow: Employee -> Team Lead/Manager -> HR (final)
 */
const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
  stage: { type: Number, required: true }, // 1=Team Lead/Manager, 2=HR final
  approverRole: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  remarks: { type: String },
  actionAt: { type: Date },
}, { _id: false });

const leavesSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String },
    employeeCode: { type: String },
    leaveType: {
      type: String,
      enum: ['paid', 'casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true },
    dutyDates: { type: [String], default: [] },
    reason: { type: String },
    emergencyContact: { type: String },
    requestKind: {
      type: String,
      enum: ['normal', 'late_conversion'],
      default: 'normal',
    },
    selectedLateAttendanceIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
    }],
    selectedLateDates: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    currentStage: { type: Number, default: 1 }, // which approval step is active
    approvalChain: { type: [approvalStepSchema], default: [] },
    cancellationReason: { type: String },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

leavesSchema.index({ companyId: 1, status: 1 });
leavesSchema.index({ companyId: 1, status: 1, createdAt: -1 });
leavesSchema.index({ companyId: 1, currentStage: 1, status: 1, createdAt: -1 });
leavesSchema.index({ employeeId: 1, startDate: -1 });
leavesSchema.index({ employeeId: 1, requestKind: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leavesSchema);
