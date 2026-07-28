const mongoose = require('mongoose');

const callTransferSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  transferredEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  // Legacy employee reference retained for records created before business-owner capture.
  ownerManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  businessOwnerName: { type: String, trim: true, maxlength: 150 },
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  transferDate: { type: Date, required: true },
  targetMonth: { type: Number, required: true, min: 1, max: 12 },
  targetYear: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  decisionReason: { type: String, trim: true, maxlength: 500 },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  decidedAt: Date,
}, { timestamps: true });

callTransferSchema.index({ companyId: 1, submittedBy: 1, targetYear: 1, targetMonth: 1, status: 1 });
callTransferSchema.index({ companyId: 1, teamLeadId: 1, status: 1, transferDate: -1 });

module.exports = mongoose.model('CallTransfer', callTransferSchema);
