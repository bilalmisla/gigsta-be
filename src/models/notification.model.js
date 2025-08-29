const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    metadata: { type: Object, required: false, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    deliveryStatus: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

notificationSchema.pre(/^find/, function (next) {
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('Notification', notificationSchema);


