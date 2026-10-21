const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  type: { type: String, enum: ['heading', 'paragraph', 'bullets', 'numbered'], required: true },
  text: { type: String, required: true },
}, { _id: false });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, trim: true, lowercase: true },
  summary: { type: String, default: '', maxlength: 400 },
  audience: { type: String, enum: ['all', 'department'], default: 'all', required: true },
  departments: { type: [String], default: [] },
  blocks: { type: [blockSchema], default: [] },
  revision: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ companyId: 1, deletedAt: 1, createdAt: -1 });
schema.index({ companyId: 1, slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

module.exports = mongoose.model('TrainingCategory', schema);
