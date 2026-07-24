const mongoose = require('mongoose');
const { Notification } = require('../models');
const { CustomException } = require('../utils');

/** Accept only a valid ObjectId string; returns a server-built ObjectId (never raw query values). */
const toSafeObjectId = (value) => {
    if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
        return undefined;
    }
    return new mongoose.Types.ObjectId(value);
};

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
        const safeCursor = toSafeObjectId(cursor);
        if (!safeCursor) {
            throw CustomException('Invalid cursor', 400);
        }
        query._id = { $lt: safeCursor };
    }
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const items = await Notification.find(query)
        .sort({ _id: -1 })
        .limit(parsedLimit);
    const nextCursor = items.length ? items.at(-1)._id : null;
    return response.send({ items, nextCursor });
};

const markRead = async (request, response) => {
    const { id } = request.params;
    const userId = request.userID;
    const safeId = toSafeObjectId(id);
    if (!safeId) {
        throw CustomException('Invalid notification id', 400);
    }
    const updated = await Notification.findOneAndUpdate(
        { _id: safeId, userId },
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


