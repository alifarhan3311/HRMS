/**
 * modules/auth/auth.model.js
 * Mongoose schema for Session. Field-level encryption is applied via
 * set/get transforms on sensitive fields, so callers work with plaintext
 * in application code while ciphertext is what's persisted/read from disk.
 * NOTE: reading encrypted getters requires { toJSON:{getters:true}, toObject:{getters:true} }.
 */
const mongoose = require('mongoose');

const authSchema = new mongoose.Schema(
  {
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  refreshTokenHash: { type: String, required: true },
  userAgent: { type: String },
  ipAddress: { type: String },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

authSchema.index({ employeeId: 1, revoked: 1, expiresAt: 1 });
authSchema.index({ revoked: 1, expiresAt: 1 });
authSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', authSchema);
