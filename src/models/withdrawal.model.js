const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    sellerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema); 