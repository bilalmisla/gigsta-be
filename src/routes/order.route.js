const express = require('express');
const { userMiddleware } = require('../middlewares');
const { 
    getOrders, paymentIntent, updatePaymentStatus, 
    createOrders, createPayment, 
    getOrderDetailsById 
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

app.post('/create', userMiddleware, createOrders);

module.exports = app;