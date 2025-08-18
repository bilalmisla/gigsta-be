const express = require('express');
const { userMiddleware } = require('../middlewares');
const { addIbanPaymentMethod, listPaymentMethods } = require('../controllers/paymentMethod.controller');

const app = express.Router();

app.post('/iban', userMiddleware, addIbanPaymentMethod);
app.get('/', userMiddleware, listPaymentMethods);

module.exports = app; 