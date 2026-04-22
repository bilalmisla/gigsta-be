const express = require('express');
const { validateCoupon, createCoupon, getCoupons, deleteCoupon, changeCouponStatus } = require('../controllers/coupon.controller');
const { userMiddleware } = require('../middlewares');
const app = express.Router();

app.post('/validate', userMiddleware, validateCoupon);
app.post('/', userMiddleware, createCoupon);
app.get('/', userMiddleware, getCoupons);
app.delete('/:id', userMiddleware, deleteCoupon);
app.patch('/:id/status', userMiddleware, changeCouponStatus);

module.exports = app;
