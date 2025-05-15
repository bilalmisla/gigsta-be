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
    deletedBySeller: {
        type: Boolean,
        default: false
    },
    deletedByBuyer: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

conversationSchema.pre(/^find/, function (next) {
    // Exclude conversations that have been deleted by the current user
    const userId = this.getQuery().userId;
    if (userId) {
        this.or([
            { sellerID: userId, deletedBySeller: false },
            { buyerID: userId, deletedByBuyer: false }
        ]);
    }
    next();
});

module.exports = mongoose.model('Conversation', conversationSchema);