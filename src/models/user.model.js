const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: false,
    },
    facebookId: {
        type: String,
        required: false,
    },
    googleId: {
        type: String,
        required: false,
    },
    // confirm_new_password: {
    //     type: String,
    //     required: true,
    // },
    image: {
        type: String,
        required: false,
    },
    country: {
        type: String,
        required: false,
    },
    phone: {
        type: String,
        required: false,
    },
    description: {
        type: String,
        required: false,
    },
    tagline: {
        type: String,
        required: false,
        default: null
    },
    fullname: {
        type: String,
        required: false,
        default: null
    },
    postalCode: {
        type: String,
        required: false,
        default: null
    },
    address: {
        type: String,
        required: false,
        default: null
    },
    isSeller: {
        type: Boolean,
        default: false,
        required: false,
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    stripeAccountId: {
        type: String,
        required: false
    },
    stripeCustomerId: { type: String },
    deletedAt: { // Add this field for soft deletion
        type: Date,
        default: null
    }
}, {
    versionKey: false,
    timestamps: true
});

userSchema.pre(/^find/, function (next) {
    if (!this.getOptions().bypassDeletedCheck) {
        this.where({ deletedAt: null }); // Apply filter only when not explicitly bypassed
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
