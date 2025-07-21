const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stripeCustomerId: { type: String, required: true },
    stripePaymentMethodId: { type: String, required: true },
    iban: { type: String, required: true },
    account_holder_name: { type: String, required: true },
    country: { type: String, required: true },
    currency: { type: String, required: true },
    bank_name: { type: String },
    last4: { type: String },
    status: { type: String }, // e.g. 'verified', 'new', etc.
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema); 