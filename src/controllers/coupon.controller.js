const { Coupon } = require('../models');
const { CustomException } = require('../utils');

const validateCoupon = async (req, res) => {
    const { code } = req.body;

    try {
        if (!code) {
            throw CustomException('Coupon code is required!', 400);
        }

        const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

        if (!coupon) {
            throw CustomException('Invalid coupon code.', 404);
        }

        if (!coupon.isActive) {
            throw CustomException('This coupon is no longer active.', 400);
        }

        if (new Date(coupon.expiryDate) < new Date()) {
            throw CustomException('This coupon has expired.', 400);
        }

        return res.send({
            error: false,
            message: 'Coupon applied successfully!',
            coupon: {
                code: coupon.code,
                discountPercent: coupon.discountPercent
            }
        });
    } catch ({ message, status = 500 }) {
        return res.status(status).send({
            error: true,
            message
        });
    }
};

const createCoupon = async (req, res) => {
    const { code, discountPercent, isActive, expiryDate } = req.body;

    try {
        if (!code || !discountPercent || !expiryDate) {
            throw CustomException('Code, discount percent, and expiry date are required.', 400);
        }

        const coupon = new Coupon({
            code: code.trim().toUpperCase(),
            discountPercent,
            isActive: isActive !== undefined ? isActive : true,
            expiryDate
        });

        await coupon.save();

        return res.send({
            error: false,
            message: 'Coupon created successfully.',
            coupon
        });
    } catch ({ message, status = 500 }) {
        if (message.includes('E11000')) {
            message = 'Coupon code already exists.';
            status = 400;
        }
        return res.status(status).send({
            error: true,
            message
        });
    }
};

const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        return res.send({
            error: false,
            coupons
        });
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

const changeCouponStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            throw CustomException('Coupon not found.', 404);
        }
        
        coupon.isActive = isActive !== undefined ? isActive : !coupon.isActive;
        await coupon.save();

        return res.send({
            error: false,
            message: 'Coupon status updated successfully.',
            coupon
        });
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

const deleteCoupon = async (req, res) => {
    const { id } = req.params;

    try {
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            throw CustomException('Coupon not found.', 404);
        }

        return res.send({
            error: false,
            message: 'Coupon deleted successfully.'
        });
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

module.exports = {
    validateCoupon,
    createCoupon,
    getCoupons,
    changeCouponStatus,
    deleteCoupon
};
