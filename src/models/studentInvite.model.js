const mongoose = require('mongoose');

const studentInviteSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    inviteToken: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired'],
        default: 'pending'
    },
    expiresAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 604800 // 7 days in seconds
    },
    acceptedAt: {
        type: Date,
        default: null
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    versionKey: false,
    timestamps: true
});

// Index for faster queries
studentInviteSchema.index({ inviteToken: 1 });
studentInviteSchema.index({ email: 1 });
studentInviteSchema.index({ invitedBy: 1 });

module.exports = mongoose.model('StudentInvite', studentInviteSchema);
