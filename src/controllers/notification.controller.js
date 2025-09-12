const { Notification } = require('../models');
const { CustomException } = require('../utils');

const createNotification = async ({ userId, actorId, type, title, body, metadata }) => {
    const notification = new Notification({ userId, actorId, type, title, body, metadata });
    await notification.save();
    return notification;
};

const getNotifications = async (request, response) => {
    const { cursor, limit = 20 } = request.query;
    const userId = request.userID;
    const query = { userId };
    if (cursor) {
        query._id = { $lt: cursor };
    }
    const items = await Notification.find(query)
        .sort({ _id: -1 })
        .limit(Number(limit));
    const nextCursor = items.length ? items[items.length - 1]._id : null;
    return response.send({ items, nextCursor });
};

const markRead = async (request, response) => {
    const { id } = request.params;
    const userId = request.userID;
    const updated = await Notification.findOneAndUpdate(
        { _id: id, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
    );
    if (!updated) {
        throw CustomException('Notification not found', 404);
    }
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return response.send({ success: true, unreadCount });
};

const markAllRead = async (request, response) => {
    const userId = request.userID;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
    return response.send({ success: true, unreadCount: 0 });
};

const getUnreadCount = async (request, response) => {
    const userId = request.userID;
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return response.send({ unreadCount });
};

module.exports = {
    createNotification,
    getNotifications,
    markRead,
    markAllRead,
    getUnreadCount
};


