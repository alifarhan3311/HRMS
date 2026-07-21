const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  graceMinutes: { type: Number, default: 15, min: 0, max: 180 },
  requiredMinutes: { type: Number, default: 480, min: 60, max: 1440 },
  breakMinutes: { type: Number, default: 0, min: 0, max: 240 },
  halfDayMinutes: { type: Number, default: 240, min: 30, max: 720 },
  overtimeAfterMinutes: { type: Number, default: 480, min: 60, max: 1440 },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  isActive: { type: Boolean, default: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

shiftSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Shift', shiftSchema);
