const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    totalStars: {
        type: Number,
        default: 0,
        required: false
    },
    starNumber: {
        type: Number,
        default: 0,
        required: false
    },
    category: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    cover: {
        type: String,
        required: true,
    },
    images: {
        type: [String],
        required: false,
    },
    shortTitle: {
        type: String,
        required: true,
    },
    shortDesc: {
        type: String, 
        required: true,
    },
    deliveryTime: {
        type: String,
        required: true,
    },
    revisionNumber: {
        type: Number,
        required: true,
    },
    features: {
        type: [String],
        required: false,
    },
    sales: {
        type: Number,
        required: false,
        default: 0
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    versionKey: false,
    timestamps: true
});

gigSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model('Gig', gigSchema);