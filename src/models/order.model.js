// const mongoose = require('mongoose');

// const orderSchema = new mongoose.Schema({
//     gigID: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Gig',
//         required: true,
//     },
//     image: {
//         type: String,
//         required: false,
//     },
//     title: {
//         type: String,
//         required: true,
//     },
//     price: {
//         type: Number,
//         required: true,
//     },
//     sellerID: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     buyerID: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//     },
//     isCompleted: {
//         type: Boolean,
//         default: false,
//     },
//     payment_intent: {
//         type: String,
//         required: true,
//     },
// }, {
//     versionKey: false
// });

// module.exports = mongoose.model('Order', orderSchema);

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    buyerID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gigs: [{
        gigID: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: true },
        image: String,
        title: String,
        sellerID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        price: Number,
        quantity: Number,
        total: Number
    }],
    totalAmount: { type: Number, required: true },
    payment_intent: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    // New optional delivery date for the overall order
    deliveryDate: { type: Date, default: null },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    deletedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

orderSchema.pre(/^find/, function (next) {
    // Exclude soft-deleted records from all find queries
    this.where({ deletedAt: null });
    next();
});

module.exports = mongoose.model("Order", orderSchema);
