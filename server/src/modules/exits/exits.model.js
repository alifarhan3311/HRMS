const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  role: { type: String, required: true },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  status: { type: String, enum: ['pending', 'acknowledged', 'recommended', 'rejected'], default: 'pending' },
  comments: String,
  decidedAt: Date,
}, { _id: false });

const checklistSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  completed: { type: Boolean, default: false },
  notes: String,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  completedAt: Date,
}, { _id: false });

const exitSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  resignationDate: { type: Date, required: true },
  proposedLastWorkingDay: { type: Date, required: true },
  finalLastWorkingDay: Date,
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  comments: { type: String, trim: true, maxlength: 3000 },
  attachmentUrl: String,
  status: {
    type: String,
    enum: ['pending_approval', 'hr_review', 'accepted', 'rejected', 'withdrawn', 'clearance', 'completed'],
    default: 'pending_approval',
  },
  currentApprovalIndex: { type: Number, default: 0 },
  approvals: { type: [approvalSchema], default: [] },
  hrDecision: {
    action: { type: String, enum: ['accept', 'reject', 'revise', 'notice_waiver', 'immediate_release'] },
    comments: String,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    decidedAt: Date,
  },
  checklist: { type: [checklistSchema], default: [] },
  settlement: {
    salaryUntilLastDay: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    unpaidLeaveDeduction: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    notes: String,
  },
  exitInterviewNotes: String,
  withdrawnAt: Date,
  completedAt: Date,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

exitSchema.index({ companyId: 1, status: 1, createdAt: -1 });
exitSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('EmployeeExit', exitSchema);
