const mongoose = require('mongoose');

const orderStatusSchema = new mongoose.Schema({
    buyerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sellerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        required: true,
    },
    revisionRequestedCount: {
        type: Number,
        required: false,
        default: 0
    },
    orderID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    gigID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gig',
        required: false
    },
    withdrawn: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    versionKey: false,
    timestamps: true
});

orderStatusSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('OrderStatus', orderStatusSchema);