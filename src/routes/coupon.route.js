const express = require('express');
const { validateCoupon, createCoupon, getCoupons } = require('../controllers/coupon.controller');
const { userMiddleware } = require('../middlewares');
const app = express.Router();

app.post('/validate', userMiddleware, validateCoupon);
app.post('/', userMiddleware, createCoupon);
app.get('/', userMiddleware, getCoupons);

module.exports = app;
