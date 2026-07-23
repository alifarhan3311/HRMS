/**
 * modules/leaves/leaves.model.js
 * Leave request with multi-stage approval chain.
 * Workflow: Employee → Team Lead → HR → Final Approver (Admin/Super Admin)
 */
const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
  stage: { type: Number, required: true }, // 1=TeamLead, 2=HR, 3=Admin
  approverRole: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  remarks: { type: String },
  actionAt: { type: Date },
}, { _id: false });

const leavesSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: {
      type: String,
      enum: ['paid', 'casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true },
    reason: { type: String },
    emergencyContact: { type: String },
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

module.exports = mongoose.model('LeaveRequest', leavesSchema);
