const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  assignmentDate: { type: Date, required: true },
  conditionAtAssignment: { type: String, trim: true, maxlength: 100 },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  assignmentNotes: { type: String, trim: true, maxlength: 1000 },
  returnDate: Date,
  conditionAtReturn: { type: String, trim: true, maxlength: 100 },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  returnNotes: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['active', 'returned', 'lost', 'stolen'], default: 'active', index: true },
}, { timestamps: true });

assignmentSchema.index({ assetId: 1, status: 1 });
assignmentSchema.index({ employeeId: 1, status: 1 });

module.exports = mongoose.model('AssetAssignment', assignmentSchema);
