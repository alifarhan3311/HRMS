const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
  issue: { type: String, required: true, trim: true, maxlength: 1000 },
  reportedDate: { type: Date, required: true },
  sentForRepairDate: Date,
  vendorTechnician: { type: String, trim: true, maxlength: 200 },
  repairCost: { type: Number, min: 0, default: 0 },
  repairDetails: { type: String, trim: true, maxlength: 2000 },
  completionDate: Date,
  status: { type: String, enum: ['reported', 'in_repair', 'completed', 'cancelled'], default: 'reported' },
  notes: { type: String, trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

maintenanceSchema.index({ assetId: 1, reportedDate: -1 });
module.exports = mongoose.model('AssetMaintenance', maintenanceSchema);
