const express = require('express');
const userMiddleware = require('../middlewares/userMiddleware');
const { getNotifications, markRead, markAllRead, getUnreadCount } = require('../controllers/notification.controller');

const app = express.Router();

app.get('/', userMiddleware, getNotifications);
app.get('/unread-count', userMiddleware, getUnreadCount);
app.post('/:id/read', userMiddleware, markRead);
app.post('/read-all', userMiddleware, markAllRead);

module.exports = app;


