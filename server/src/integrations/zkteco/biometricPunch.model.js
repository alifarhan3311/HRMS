const mongoose = require('mongoose');

const biometricPunchSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true, immutable: true },
  deviceId: { type: String, required: true, index: true },
  deviceUserId: { type: String, required: true, index: true },
  punchTime: { type: Date, required: true, index: true },
  verificationMode: { type: String, default: 'unknown' },
  punchStatus: { type: String, default: 'unknown' },
  source: { type: String, enum: ['realtime', 'polling'], required: true },
  processingStatus: {
    type: String,
    enum: ['received', 'processed', 'unmapped', 'ignored', 'error'],
    default: 'received',
    index: true,
  },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  attendanceAction: String,
  error: String,
  raw: mongoose.Schema.Types.Mixed,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
}, { timestamps: true });

biometricPunchSchema.index({ companyId: 1, deviceId: 1, punchTime: -1 });

const biometricSyncStateSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  initializedAt: { type: Date, default: Date.now },
  lastLogTime: { type: Date, default: Date.now },
  lastConnection: Date,
  lastSuccessfulSync: Date,
  libraryUsed: String,
}, { timestamps: true });

module.exports = {
  BiometricPunch: mongoose.model('BiometricPunch', biometricPunchSchema),
  BiometricSyncState: mongoose.model('BiometricSyncState', biometricSyncStateSchema),
};
