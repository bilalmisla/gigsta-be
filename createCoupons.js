require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('./src/models/coupon.model');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function createTestCoupon() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');
        
        let existing = await Coupon.findOne({ code: 'GIGSTA50' });
        if (!existing) {
            const coupon = new Coupon({
                code: 'GIGSTA50',
                discountPercent: 50,
                isActive: true,
                expiryDate: new Date('2030-12-31')
            });
            await coupon.save();
            console.log('Created test coupon: GIGSTA50 (50% off)');
        } else {
            console.log('Test coupon GIGSTA50 already exists.');
        }

        let existing2 = await Coupon.findOne({ code: 'SAVE20' });
        if (!existing2) {
            const coupon2 = new Coupon({
                code: 'SAVE20',
                discountPercent: 20,
                isActive: true,
                expiryDate: new Date('2030-12-31')
            });
            await coupon2.save();
            console.log('Created test coupon: SAVE20 (20% off)');
        } else {
            console.log('Test coupon SAVE20 already exists.');
        }

    } catch (e) {
        console.error('Error creating coupon', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

createTestCoupon();
