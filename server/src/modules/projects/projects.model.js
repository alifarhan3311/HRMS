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
  startDate: { type: Date },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'active',
  },
  teamMembers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  billableHours: { type: Number, default: 0 },
  incentivePool: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Company' },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

projectsSchema.index({ companyId: 1 });

module.exports = mongoose.model('Project', projectsSchema);
