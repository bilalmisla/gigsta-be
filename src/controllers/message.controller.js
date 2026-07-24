const { Message, Conversation, User } = require('../models');
const nodemailer = require('nodemailer');
const { formatTimestamp, fetchFileBuffer } = require('../utils');
const { generateEmailTemplate } = require('../utils/emailTemplates');
const { createNotification } = require('./notification.controller');
const { emitToUser } = require('../server-realtime');

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toSafeConversationId = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return UUID_V4_PATTERN.test(trimmed) ? trimmed : undefined;
};

const toSafeMessageText = (value) => {
  if (typeof value !== 'string') return '';
  return value.slice(0, 5000);
};

const toSafeFileUrls = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((url) => typeof url === 'string' && url.trim()).slice(0, 20);
};

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendMessageEmail = async (sender, receiver, conversation, fileUrls) => {
  const emailData = {
    logoUrl: 'https://gigsta.ai/media/logo-black-text.png',
    notificationText: sender.username,
    senderName: sender.username,
    senderAvatar: sender.image,
    timestamp: formatTimestamp(),
    messageContent: conversation.lastMessage,
    replyUrl: `${process.env.FRONTEND_URL}/message/${conversation.conversationID}`,
    companyName: 'Gigsta AI',
    year: new Date().getFullYear()
  };

  const fileAttachments = await Promise.all(
    fileUrls.map(fetchFileBuffer)
  );

  const mailOptions = {
    from: `"${sender.username} via Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
    to: receiver.email,
    subject: `You have unread messages from ${sender.username}`,
    html: generateEmailTemplate(emailData),
    attachments: fileAttachments
  };

  await transporter.sendMail(mailOptions);
};

const createMessage = async (request, response) => {
  const { conversationID, description, fileUrls, gigId, orderId } = request.body;

  try {
    const safeConversationId = toSafeConversationId(conversationID);
    if (!safeConversationId) {
      return response.status(400).send({
        error: true,
        message: 'Invalid conversation ID'
      });
    }

    const safeDescription = toSafeMessageText(description);
    const safeFileUrls = toSafeFileUrls(fileUrls);

    const message = new Message({
      conversationID: safeConversationId,
      userID: request.userID,
      description: safeDescription,
      files: safeFileUrls
    });

    await message.save();
    await Conversation.findOneAndUpdate(
      { conversationID: { $eq: safeConversationId } },
      {
        $set: {
          readBySeller: Boolean(request.isSeller),
          readByBuyer: !request.isSeller,
          lastMessage: safeDescription,
          deletedByBuyer: false,
          deletedBySeller: false
        }
      },
      { new: true }
    );

    const conversation = await Conversation.findOne({ conversationID: { $eq: safeConversationId } });

    const sender = await User.findOne({ _id: request.isSeller ? conversation.sellerID : conversation.buyerID });
    const receiver = await User.findOne({ _id: request.isSeller ? conversation.buyerID : conversation.sellerID });

    await sendMessageEmail(sender, receiver, conversation, safeFileUrls);
    // Create real-time notification to receiver
    const notif = await createNotification({
      userId: receiver._id,
      actorId: sender._id,
      type: 'chat.message',
      title: `New message from ${sender.username}`,
      body: safeDescription,
      metadata: { conversationID: safeConversationId, gigId, orderId }
    });
    emitToUser(receiver._id.toString(), 'notification:new', {
      id: notif._id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      metadata: notif.metadata,
      createdAt: notif.createdAt
    });
    return response.status(201).send(message);
  }
  catch ({ message, status = 500 }) {
    return response.status(status).send({
      error: true,
      message
    })
  }
}

const getMessages = async (request, response) => {
  const { conversationID } = request.params;
  try {
    const safeConversationId = toSafeConversationId(conversationID);
    if (!safeConversationId) {
      return response.status(400).send({
        error: true,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await Conversation.findOne({ conversationID: { $eq: safeConversationId } })
      .populate('sellerID', 'username fullname image email').populate('buyerID', 'username fullname image email');
    const messages = await Message.find({ conversationID: { $eq: safeConversationId } })
      .populate('userID', 'username fullname image email');
    return response.send({ data: messages, conversation });
  }
  catch ({ message, status = 500 }) {
    return response.status(status).send({
      error: true,
      message
    })
  }
}

const deleteMessage = async (request, response) => {
  const { messageID } = request.params;
  
  try {
    const safeConversationId = toSafeConversationId(messageID);
    if (!safeConversationId) {
      return response.status(400).send({
        error: true,
        message: 'Invalid conversation ID'
      });
    }

    const message = await Message.findOne({ conversationID: { $eq: safeConversationId } });
    
    if (!message) {
      return response.status(404).send({
        error: true,
        message: 'Message not found'
      });
    }

    // Add the user to the deletedBy array
    const softDeleteUpdate = request.isSeller
      ? { $set: { deletedBySeller: true } }
      : { $set: { deletedByBuyer: true } };
    await Message.findOneAndUpdate(
      { conversationID: { $eq: safeConversationId } },
      softDeleteUpdate,
      { new: true }
    );

    // Create notifications for both parties about message deletion
    try {
      const conversation = await Conversation.findOne({ conversationID: { $eq: safeConversationId } });
      if (conversation) {
        const actor = await User.findById(request.userID);
        const receiverId = request.isSeller ? conversation.buyerID : conversation.sellerID;

        const notification = await createNotification({
          userId: receiverId,
          actorId: request.userID,
          type: 'message.deleted',
          title: 'Message deleted',
          body: `${actor?.username || 'User'} deleted a message in your conversation`,
          metadata: { conversationID: safeConversationId }
        });

        emitToUser(receiverId.toString(), 'notification:new', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          metadata: notification.metadata,
          createdAt: notification.createdAt
        });
      }
    } catch (error) {
      console.error('Error creating message deletion notification:', error);
    }
    
    return response.status(200).send({
      success: true,
      message: 'Message deleted successfully'
    });
  }
  catch ({ message, status = 500 }) {
    return response.status(status).send({
      error: true,
      message
    });
  }
};

const deleteConversation = async (request, response) => {
  const { conversationID } = request.params;
  
  try {
    const safeConversationId = toSafeConversationId(conversationID);
    if (!safeConversationId) {
      return response.status(400).send({
        error: true,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await Conversation.findOne({ conversationID: { $eq: safeConversationId } });
    
    if (!conversation) {
      return response.status(404).send({
        error: true,
        message: 'Conversation not found'
      });
    }
    
    const softDeleteUpdate = request.isSeller
      ? { $set: { deletedBySeller: true } }
      : { $set: { deletedByBuyer: true } };
    await Conversation.findOneAndUpdate(
      { conversationID: { $eq: safeConversationId } },
      softDeleteUpdate,
      { new: true }
    );

    // Create notifications for both parties about conversation deletion
    try {
      const actor = await User.findById(request.userID);
      const receiverId = request.isSeller ? conversation.buyerID : conversation.sellerID;

      const notification = await createNotification({
        userId: receiverId,
        actorId: request.userID,
        type: 'conversation.deleted',
        title: 'Conversation deleted',
        body: `${actor?.username || 'User'} deleted the conversation`,
        metadata: { conversationID: safeConversationId }
      });

      emitToUser(receiverId.toString(), 'notification:new', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      });
    } catch (error) {
      console.error('Error creating conversation deletion notification:', error);
    }
    
    return response.status(200).send({
      success: true,
      message: 'Conversation deleted successfully'
    });
  }
  catch ({ message, status = 500 }) {
    return response.status(status).send({
      error: true,
      message
    });
  }
};

module.exports = {
  createMessage,
  getMessages,
  deleteMessage,
  deleteConversation
}
