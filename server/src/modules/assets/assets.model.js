const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assetCode: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  brand: { type: String, trim: true, maxlength: 100 },
  model: { type: String, trim: true, maxlength: 100 },
  serialNumber: { type: String, trim: true, maxlength: 150 },
  purchaseDate: Date,
  purchaseCost: { type: Number, min: 0, default: 0 },
  vendor: { type: String, trim: true, maxlength: 150 },
  warrantyExpiryDate: Date,
  department: { type: String, trim: true, maxlength: 100 },
  location: { type: String, trim: true, maxlength: 150, default: 'Main Office' },
  status: {
    type: String,
    enum: ['in_stock', 'assigned', 'under_repair', 'returned', 'lost', 'stolen', 'retired', 'disposed'],
    default: 'in_stock',
    index: true,
  },
  assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  currentAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetAssignment', default: null },
  condition: { type: String, trim: true, maxlength: 100, default: 'Good' },
  network: {
    ipAddress: { type: String, trim: true, maxlength: 64 },
    macAddress: { type: String, trim: true, maxlength: 64 },
    hostname: { type: String, trim: true, maxlength: 150 },
    lastSeen: Date,
    presenceStatus: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
  },
  incident: {
    type: { type: String, enum: ['lost', 'stolen'] },
    date: Date,
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    description: { type: String, trim: true, maxlength: 2000 },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  notes: { type: String, trim: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

assetSchema.index({ companyId: 1, assetCode: 1 }, { unique: true });
assetSchema.index(
  { companyId: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $type: 'string' } } },
);
assetSchema.index({ companyId: 1, category: 1, status: 1 });

module.exports = mongoose.model('Asset', assetSchema);
