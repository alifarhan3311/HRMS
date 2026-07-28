const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  role: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: { type: String, trim: true, maxlength: 500 },
  decidedAt: Date,
}, { _id: false });

const callSaleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  saleDate: { type: Date, required: true },
  businessName: { type: String, required: true, trim: true, maxlength: 150 },
  ownerName: { type: String, required: true, trim: true, maxlength: 150 },
  product: {
    type: String,
    enum: ['pos', 'atm_service', 'accounting', 'osap', 'digital_media_service', 'pr', 'insurance'],
    required: true,
  },
  targetMonth: { type: Number, required: true, min: 1, max: 12 },
  targetYear: { type: Number, required: true },
  approvalChain: { type: [approvalSchema], default: [] },
  currentApproverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  finalApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  finalApprovedAt: Date,
}, { timestamps: true });

callSaleSchema.index({ companyId: 1, submittedBy: 1, targetYear: 1, targetMonth: 1, status: 1 });
callSaleSchema.index({ companyId: 1, currentApproverId: 1, status: 1, saleDate: -1 });

module.exports = mongoose.model('CallSale', callSaleSchema);
