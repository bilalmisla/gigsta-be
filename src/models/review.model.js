const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    gigID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gig',
        required: true
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    star: {
        type: Number,
        required: true,
        max: 5
    },
    description: {
        type: String,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    versionKey: false
});

reviewSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('Review', reviewSchema);