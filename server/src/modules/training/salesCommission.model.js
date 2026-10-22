const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCommission' },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  unit: { type: String, enum: ['PKR', 'percent'], required: true },
  rate: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  salesAmount: { type: Number, min: 0, default: 0 },
  commissionAmount: { type: Number, required: true, min: 0, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2000, max: 2100 },
  items: { type: [itemSchema], default: [] },
  totalCommission: { type: Number, required: true, min: 0, default: 0 },
  revision: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
}, { timestamps: true });

schema.index({ companyId: 1, employeeId: 1, year: 1, month: 1 }, { unique: true });
schema.index({ companyId: 1, year: 1, month: 1 });

module.exports = mongoose.model('SalesCommission', schema);
