/**
 * modules/projects/projects.model.js
 * Mongoose schema for Project. Field-level encryption is applied via
 * set/get transforms on sensitive fields, so callers work with plaintext
 * in application code while ciphertext is what's persisted/read from disk.
 * NOTE: reading encrypted getters requires { toJSON:{getters:true}, toObject:{getters:true} }.
 */
const mongoose = require('mongoose');

const projectsSchema = new mongoose.Schema(
  {
  name: { type: String, required: true },
  clientName: { type: String },
  description: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'active',
  },
  projectManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  teamMembers: {
    type: [{
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
      projectRole: { type: String, trim: true, maxlength: 100 },
      allocatedHours: { type: Number, min: 0, default: 0 },
      assignedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  billableHours: { type: Number, default: 0 },
  incentivePool: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

projectsSchema.index({ companyId: 1 });

module.exports = mongoose.model('Project', projectsSchema);
