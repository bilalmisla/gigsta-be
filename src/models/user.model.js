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
    isSeller: {
        type: Boolean,
        default: false,
        required: false,
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    }
}, {
    versionKey: false,
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);