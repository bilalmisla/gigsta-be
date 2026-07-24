const mongoose = require('mongoose');
const { Coupon, OrderStatus, User } = require('../models');

const TAX_RATE = 0.045; // 4.5%

const WITHDRAWAL_SELLER_POPULATE =
    'fullname username email image country address postalCode state phone isSeller createdAt';

const toDisplayText = (value, fallback = '') =>
    (typeof value === 'string' || typeof value === 'number') ? String(value) : fallback;

/** Accept only a valid ObjectId string; returns a server-built ObjectId (never raw body values). */
const toSafeObjectId = (value) => {
    if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
        return undefined;
    }
    return new mongoose.Types.ObjectId(value);
};

const applyCouponDiscount = async (subtotal, couponCode) => {
    let discountAmount = 0;
    let adjustedSubtotal = subtotal;

    if (couponCode) {
        const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });
        if (coupon?.isActive && new Date(coupon?.expiryDate) >= new Date()) {
            discountAmount = Number.parseFloat(((adjustedSubtotal * coupon.discountPercent) / 100).toFixed(2));
            adjustedSubtotal -= discountAmount;
        }
    }

    return { subtotal: adjustedSubtotal, discountAmount };
};

const calculateTaxTotals = (subtotal) => {
    const taxAmount = Number.parseFloat((subtotal * TAX_RATE).toFixed(2));
    const totalWithTax = subtotal + taxAmount;
    return { taxAmount, totalWithTax };
};

const buildOrderItemFromGig = (gig, { buyerID, quantity = 1, total }) => ({
    gigID: gig._id,
    image: gig.cover,
    title: gig.title,
    buyerID,
    sellerID: gig.userID,
    price: gig.price,
    deliveryTime: gig.deliveryTime,
    quantity,
    total: total ?? gig.price * quantity
});

const formatWithdrawalDetails = (withdrawal) => ({
    ...withdrawal.toObject(),
    seller: withdrawal.sellerID,
    accountDetails: {
        accountHolderName: withdrawal.accountHolderName,
        routingNumber: withdrawal.routingNumber,
        accountNumber: withdrawal.accountNumber,
        accountType: withdrawal.accountType,
        country: withdrawal.country
    }
});

const assertAdmin = async (userId) => {
    const user = await User.findById(userId);
    if (user?.role !== 'admin') {
        const error = new Error('Forbidden: admin role required.');
        error.status = 403;
        throw error;
    }
    return user;
};

const assertWithdrawalAccess = (user, withdrawal) => {
    const isAdmin = user.role === 'admin';
    const isSeller = user.isSeller && withdrawal.sellerID._id.toString() === user._id.toString();

    if (!isAdmin && !isSeller) {
        const error = new Error('Access denied. You can only view your own withdrawals.');
        error.status = 403;
        throw error;
    }

    return { isAdmin, isSeller };
};

const createOrderStatusEntry = async ({
    buyerID,
    sellerID,
    status,
    orderID,
    gigID,
    extendRequest,
    revisionRequestedCount
}) => {
    const orderStatus = new OrderStatus({
        buyerID,
        sellerID,
        status,
        orderID,
        gigID,
        ...(extendRequest ? { extendRequest } : {})
    });

    if (revisionRequestedCount != null) {
        orderStatus.revisionRequestedCount = revisionRequestedCount;
    }

    await orderStatus.save();
    return orderStatus;
};

const findPendingExtendRequest = async (orderId, gigId) => {
    return OrderStatus.findOne({
        orderID: { $eq: orderId },
        gigID: { $eq: gigId },
        status: { $eq: 'Extend Delivery Date Requested' },
        'extendRequest.status': { $eq: 'pending' }
    }).sort({ createdAt: -1 });
};

module.exports = {
    TAX_RATE,
    WITHDRAWAL_SELLER_POPULATE,
    toDisplayText,
    toSafeObjectId,
    applyCouponDiscount,
    calculateTaxTotals,
    buildOrderItemFromGig,
    formatWithdrawalDetails,
    assertAdmin,
    assertWithdrawalAccess,
    createOrderStatusEntry,
    findPendingExtendRequest
};
