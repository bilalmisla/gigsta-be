const { Message, Conversation, User } = require('../models');
const nodemailer = require('nodemailer');
const { formatTimestamp, fetchFileBuffer } = require('../utils');
const { generateEmailTemplate } = require('../utils/emailTemplates');
const { createNotification } = require('./notification.controller');
const { emitToUser } = require('../server-realtime');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
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
    const message = new Message({
      conversationID,
      userID: request.userID,
      description,
      files: fileUrls
    })

    await message.save();
    await Conversation.findOneAndUpdate({ conversationID }, {
      $set: {
        readBySeller: request.isSeller,
        readByBuyer: !request.isSeller,
        lastMessage: description,
        deletedByBuyer: false,
        deletedBySeller: false
      }
    }, { new: true });

    const conversation = await Conversation.findOne({ conversationID });

    const sender = await User.findOne({ _id: request.isSeller ? conversation.sellerID : conversation.buyerID });
    const receiver = await User.findOne({ _id: request.isSeller ? conversation.buyerID : conversation.sellerID });

    // console.log(sender, receiver, conversation, "sender & receiver");
    await sendMessageEmail(sender, receiver, conversation, fileUrls);
    // Create real-time notification to receiver
    const notif = await createNotification({
      userId: receiver._id,
      actorId: sender._id,
      type: 'chat.message',
      title: `New message from ${sender.username}`,
      body: description,
      metadata: { conversationID, gigId, orderId }
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
    const conversation = await Conversation.findOne({ conversationID: conversationID })
      .populate('sellerID', 'username image email').populate('buyerID', 'username image email');
    const messages = await Message.find({ conversationID }).populate('userID', 'username image email');
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
    const message = await Message.findOne({ conversationID: messageID });
    
    if (!message) {
      return response.status(404).send({
        error: true,
        message: 'Message not found'
      });
    }

    // Add the user to the deletedBy array
    const updateField = request.isSeller ? 'deletedBySeller' : 'deletedByBuyer';
    await Message.findOneAndUpdate(
      { conversationID: messageID },
      { $set: { [updateField]: true } },
      { new: true }
    );

    // Create notifications for both parties about message deletion
    try {
      const conversation = await Conversation.findOne({ conversationID: messageID });
      if (conversation) {
        const actor = await User.findById(request.userID);
        const receiverId = request.isSeller ? conversation.buyerID : conversation.sellerID;

        const notification = await createNotification({
          userId: receiverId,
          actorId: request.userID,
          type: 'message.deleted',
          title: 'Message deleted',
          body: `${actor?.username || 'User'} deleted a message in your conversation`,
          metadata: { conversationID: messageID }
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
    } catch (e) {
      console.error('Error creating message deletion notification:', e);
      // Continue execution even if notification fails
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
    const conversation = await Conversation.findOne({ conversationID });
    
    if (!conversation) {
      return response.status(404).send({
        error: true,
        message: 'Conversation not found'
      });
    }
    
    // Add the user to the deletedBy array
    const updateField = request.isSeller ? 'deletedBySeller' : 'deletedByBuyer';
    await Conversation.findOneAndUpdate(
      { conversationID },
      { $set: { [updateField]: true } },
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
        metadata: { conversationID: conversationID }
      });

      emitToUser(receiverId.toString(), 'notification:new', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      });
    } catch (e) {
      console.error('Error creating conversation deletion notification:', e);
      // Continue execution even if notification fails
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