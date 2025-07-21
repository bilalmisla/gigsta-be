const express = require('express');
const { userMiddleware } = require('../middlewares');
const { 
    getOrders, paymentIntent, updatePaymentStatus, 
    createOrders, createPayment, 
    getOrderDetailsById, updateOrderStatus, getEarningStats, requestWithdrawal, getWithdrawals 
} = require('../controllers/order.controller');
const app = express.Router();

// Get all
app.get('/', userMiddleware, getOrders);

// Get order details by ID
app.get('/:id/:gig_id', userMiddleware, getOrderDetailsById);

// Payment
app.post('/create-payment-intent/:_id', userMiddleware, paymentIntent);

// Payment confirm
app.patch('/', userMiddleware, updatePaymentStatus);

// Payment confirm
app.post('/create-payment', userMiddleware, createPayment);

// Update order status based on Id
app.post('/update-status', userMiddleware, updateOrderStatus);

app.post('/create', userMiddleware, createOrders);

// Earnings stats for seller
app.get('/earnings-stats', userMiddleware, getEarningStats);

// Withdrawals
app.post('/withdraw', userMiddleware, requestWithdrawal);
app.get('/withdrawals', userMiddleware, getWithdrawals);

module.exports = app;

