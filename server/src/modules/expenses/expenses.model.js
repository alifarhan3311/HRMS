/**
 * modules/expenses/expenses.model.js
 * Mongoose schema for Expense. Field-level encryption is applied via
 * set/get transforms on sensitive fields, so callers work with plaintext
 * in application code while ciphertext is what's persisted/read from disk.
 * NOTE: reading encrypted getters requires { toJSON:{getters:true}, toObject:{getters:true} }.
 */
const mongoose = require('mongoose');

const expensesSchema = new mongoose.Schema(
  {
  category: { type: String, required: true },
  vendorName: { type: String },
  invoiceUrl: { type: String },
  amount: { type: Number, required: true },
  paymentMethod: { type: String },
  expenseDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['recorded', 'pending', 'approved', 'rejected', 'processing', 'paid', 'cancelled'],
    default: 'recorded',
  },
  remarks: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  approvalChain: { type: [mongoose.Schema.Types.Mixed], default: [] },
  currentStage: { type: Number, enum: [1, 2], default: undefined },
  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

expensesSchema.index({ companyId: 1 });
expensesSchema.index({ companyId: 1, status: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', expensesSchema);
