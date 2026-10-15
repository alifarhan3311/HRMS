const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  type: { type: String, enum: ['heading', 'paragraph', 'bullets', 'numbered'], required: true },
  text: { type: String, required: true },
}, { _id: false });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true, maxlength: 160 },
  summary: { type: String, default: '', maxlength: 300 },
  audience: { type: String, enum: ['all', 'department'], default: 'all', required: true },
  department: { type: String, default: null, trim: true, maxlength: 100 },
  blocks: { type: [blockSchema], required: true },
  revision: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ companyId: 1, deletedAt: 1, audience: 1, department: 1, createdAt: -1 });
module.exports = mongoose.model('CompanyRule', schema);
