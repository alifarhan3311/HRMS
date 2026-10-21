const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, trim: true, lowercase: true },
  amount: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ['PKR', 'percent'], required: true, default: 'PKR' },
  revision: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ companyId: 1, slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
schema.index({ companyId: 1, deletedAt: 1, name: 1 });

module.exports = mongoose.model('TrainingCommission', schema);
