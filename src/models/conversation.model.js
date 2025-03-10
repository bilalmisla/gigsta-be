const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const conversationSchema = new mongoose.Schema({
    conversationID: {
        type: String,
        default: uuidv4,
    },
    sellerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    buyerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    readBySeller: {
        type: Boolean,
        required: true,
    },
    readByBuyer: {
        type: Boolean,
        required: true,
    },
    lastMessage: {
        type: String,
        required: false,
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    versionKey: false
});

conversationSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('Conversation', conversationSchema);