const express = require('express');
const { userMiddleware } = require('../middlewares');
const { deleteUser, fetchTopSellers, createStripeAccountLink, addSellerIban, withdrawSellerFunds } = require('../controllers/user.controller');

const app = express.Router();

app.delete('/:_id', userMiddleware, deleteUser);

app.get('/top-sellers', fetchTopSellers);
app.get('/stripe/onboard', userMiddleware, createStripeAccountLink);
app.post('/stripe/add-iban', userMiddleware, addSellerIban);
app.post('/seller/withdraw', userMiddleware, withdrawSellerFunds);

module.exports = app;

