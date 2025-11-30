const express = require('express');
const { userMiddleware } = require('../middlewares');
const { getDashboardCounts } = require('../controllers/admin.controller');

const app = express.Router();

app.get('/dashboard-stats', userMiddleware, getDashboardCounts);

module.exports = app;
