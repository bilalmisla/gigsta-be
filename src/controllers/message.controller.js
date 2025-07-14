const { Message, Conversation, User } = require('../models');
const nodemailer = require('nodemailer');
const { formatTimestamp, fetchFileBuffer } = require('../utils');
const { generateEmailTemplate } = require('../utils/emailTemplates');

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
  const { conversationID, description, fileUrls } = request.body;

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