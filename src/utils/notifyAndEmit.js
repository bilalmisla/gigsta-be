const { createNotification } = require('../controllers/notification.controller');
const { emitToUser } = require('../server-realtime');

/**
 * Persist a notification and push it to the user over the realtime channel.
 */
const notifyAndEmit = async ({ userId, actorId, type, title, body, metadata }) => {
    const notification = await createNotification({
        userId,
        actorId,
        type,
        title,
        body,
        metadata
    });

    emitToUser(userId.toString(), 'notification:new', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
        createdAt: notification.createdAt
    });

    return notification;
};

module.exports = { notifyAndEmit };
