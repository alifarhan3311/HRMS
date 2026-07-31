const mongoose = require('mongoose');

const accountingTaskSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  taskDate: { type: Date, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  decisionReason: { type: String, trim: true, maxlength: 500 },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  decidedAt: Date,
}, { timestamps: true });

accountingTaskSchema.index({ companyId: 1, teamLeadId: 1, status: 1, taskDate: -1 });
accountingTaskSchema.index({ companyId: 1, submittedBy: 1, status: 1, taskDate: -1 });

module.exports = mongoose.model('AccountingTask', accountingTaskSchema);
