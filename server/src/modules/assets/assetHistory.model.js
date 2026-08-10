const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
  action: { type: String, required: true, trim: true },
  previousStatus: String,
  newStatus: String,
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  reason: { type: String, trim: true, maxlength: 1000 },
  notes: { type: String, trim: true, maxlength: 1000 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, immutable: true });

historySchema.index({ assetId: 1, createdAt: -1 });
module.exports = mongoose.model('AssetHistory', historySchema);
