const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../../utils/crypto');

const companySettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
      index: true,
    },
    company: {
      name: { type: String, default: 'My Company' },
      logoUrl: String,
      website: String,
      industry: String,
      address: String,
      timezone: { type: String, default: 'Asia/Karachi' },
    },
    timing: {
      officeStart: { type: String, default: '09:00' },
      officeEnd: { type: String, default: '18:00' },
      graceMinutes: { type: Number, default: 15, min: 0, max: 180 },
      weekendDays: { type: [Number], default: [0, 6] },
    },
    leavePolicy: {
      entitlements: {
        paid: { type: Number, default: 12, min: 0 },
        casual: { type: Number, default: 10, min: 0 },
        sick: { type: Number, default: 8, min: 0 },
        annual: { type: Number, default: 14, min: 0 },
      },
      carryForwardTypes: {
        type: [String],
        default: ['paid', 'casual', 'sick', 'annual'],
      },
      maxCarryForward: {
        paid: { type: Number, default: 365, min: 0 },
        casual: { type: Number, default: 365, min: 0 },
        sick: { type: Number, default: 365, min: 0 },
        annual: { type: Number, default: 365, min: 0 },
      },
      delayedApplicationReminderDays: { type: Number, default: 3, min: 1, max: 30 },
    },
    notifications: {
      inAppEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: false },
      whatsappEnabled: { type: Boolean, default: false },
    },
    smtp: {
      host: String,
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      user: String,
      password: { type: String, set: encryptField, get: decryptField },
      from: String,
    },
    security: {
      sessionTimeoutMinutes: { type: Number, default: 60, min: 5 },
      maxLoginAttempts: { type: Number, default: 5, min: 1 },
      passwordExpiryDays: { type: Number, default: 90, min: 0 },
      mfaEnabled: { type: Boolean, default: false },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
