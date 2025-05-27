const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationID: {
        type: String,
        required: true,
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    files: [{ type: String }], // Add this line
    deletedBySeller: {
        type: Boolean,
        default: false
    },
    deletedByBuyer: {
        type: Boolean,
        default: false
    }
}, {
    versionKey: false
});

messageSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('Message', messageSchema);