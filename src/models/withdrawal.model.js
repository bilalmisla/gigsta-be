const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    // stripeTransferId: { type: String, required: true },
    type: { type: String, enum: ['manual', 'dynamic'], default: 'manual' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
