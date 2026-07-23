const { Conversation, User } = require('../models');
const { CustomException } = require('../utils');
const { createNotification } = require('./notification.controller');
const { emitToUser } = require('../server-realtime');

const createConversation = async (request, response) => {
    const { to, from } = request.body;

    try {
        const conversation = new Conversation({
            sellerID: request.isSeller ? request.userID : to,
            buyerID: request.isSeller ? from : request.userID,
            readBySeller: request.isSeller,
            readByBuyer: !request.isSeller
        });

        await conversation.save();

        return response.status(201).send(conversation);
    }
    catch ({message, status = 500}) {
        return response.status(500).send({
            error: true,
            message
        })
    }
}

const getConversations = async (request, response) => {
    try {
        const conversation = await Conversation.find(request.isSeller ? { sellerID: request.userID, deletedBySeller: false } : { buyerID: request.userID, deletedByBuyer: false }).populate(request.isSeller ? 'buyerID' : 'sellerID', 'username fullname image email').sort({ updatedAt: -1 });
        return response.send(conversation);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const getSingleConversation = async (request, response) => {
    const { sellerID, buyerID } = request.params;
    try {
        const conversation = await Conversation.findOne({ sellerID, buyerID });
        if (!conversation) {
            throw CustomException('No such conversation found!', 404);
        }
        return response.send(conversation);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

const updateConversation = async (request, response) => {
    const { conversationID } = request.params;

    try {
        const conversation = await Conversation.findOneAndUpdate({ conversationID }, {
            $set: {
                readBySeller: true,
                readByBuyer: true
            }
        }, { new: true });

        if (conversation) {
            try {
                const actor = await User.findById(request.userID);

                if (!request.isSeller) {
                    const sellerNotification = await createNotification({
                        userId: conversation.sellerID,
                        actorId: request.userID,
                        type: 'conversation.read',
                        title: 'Conversation read',
                        body: `${actor?.username || 'Buyer'} has read the conversation`,
                        metadata: { conversationID: conversation.conversationID }
                    });

                    emitToUser(conversation.sellerID.toString(), 'notification:new', {
                        id: sellerNotification._id,
                        type: sellerNotification.type,
                        title: sellerNotification.title,
                        body: sellerNotification.body,
                        metadata: sellerNotification.metadata,
                        createdAt: sellerNotification.createdAt
                    });
                }

                if (request.isSeller) {
                    const buyerNotification = await createNotification({
                        userId: conversation.buyerID,
                        actorId: request.userID,
                        type: 'conversation.read',
                        title: 'Conversation read',
                        body: `${actor?.username || 'Seller'} has read the conversation`,
                        metadata: { conversationID: conversation.conversationID }
                    });

                    emitToUser(conversation.buyerID.toString(), 'notification:new', {
                        id: buyerNotification._id,
                        type: buyerNotification.type,
                        title: buyerNotification.title,
                        body: buyerNotification.body,
                        metadata: buyerNotification.metadata,
                        createdAt: buyerNotification.createdAt
                    });
                }
            } catch (error) {
                console.error('Error creating conversation update notification:', error);
            }
        }

        return response.send(conversation);
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
}

module.exports = {
    createConversation,
    getConversations,
    getSingleConversation,
    updateConversation
}
