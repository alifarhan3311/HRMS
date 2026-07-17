const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['not_requested', 'pending', 'sent', 'failed'],
    default: 'not_requested',
  },
  sentAt: Date,
  error: String,
}, { _id: false });

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String },
    readAt: Date,
    delivery: {
      inApp: { type: deliverySchema, default: () => ({ status: 'sent', sentAt: new Date() }) },
      email: { type: deliverySchema, default: () => ({}) },
      whatsapp: { type: deliverySchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
