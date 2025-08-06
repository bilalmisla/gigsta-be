const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    sellerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    iban: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    country: { type: String, required: false },
    type: { type: String, enum: ['manual', 'dynamic'], default: 'manual' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
