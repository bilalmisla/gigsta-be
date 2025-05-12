const { Message, Conversation, User } = require('../models');
const nodemailer = require('nodemailer');
const { formatTimestamp } = require('../utils');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// HTML Email Template Function
function generateEmailTemplate(data) {
  const {
    logoUrl,
    notificationText,
    senderName,
    senderAvatar,
    timestamp,
    messageContent,
    replyUrl,
    companyName,
    year
  } = data;

  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Notification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 4px;
          }
          .logo {
            margin-bottom: 20px;
          }
          .logo img {
            height: 40px;
          }
          .notification {
            margin-bottom: 20px;
          }
          .notification a {
            color: #f10Bad;
            text-decoration: none;
            font-weight: bold;
          }
          .message-card {
            border-bottom: 1px solid #e4e5e7;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
          }
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 10px;
          }
          .sender-info {
            flex-grow: 1;
          }
          .sender-name {
            font-weight: bold;
            margin: 0;
          }
          .timestamp {
            color: #656565;
            font-size: 14px;
            margin: 0;
          }
          .message-content {
            margin-bottom: 20px;
          }
          .reply-button {
            background-color: #f10Bad;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            border-radius: 50px;
            font-weight: bold;
          }
          .reply-text {
            margin-top: 15px;
            color: #656565;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            text-align: center;
            font-size: 14px;
            color: #656565;
          }
          .footer a {
            color: #f10Bad;
            text-decoration: none;
          }
          .download-app {
            margin: 15px 0;
          }
          .links {
            margin: 10px 0;
          }
          .links a {
            margin: 0 10px;
            color: #656565;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <img src="${logoUrl}" alt="${companyName} Logo">
          </div>
          
          <div class="notification">
            <p>You have unread messages from ${notificationText}</p>
          </div>
          
          <div class="message-card">
            <div class="message-header">
              <img class="avatar" src="${senderAvatar}" alt="${senderName}">
              <div class="sender-info">
                <p class="sender-name">${senderName}</p>
                <p class="timestamp">${timestamp}</p>
              </div>
            </div>
            
            <div class="message-content">
              <p>${messageContent}</p>
            </div>
            
            <a href="${replyUrl}" target="_blank" class="reply-button">Reply</a>
          </div>
          
          <div class="footer">
            <div class="links">
              <a href="https://gigsta.ai/privacy-policy" target="_blank">Privacy Policy</a> | 
              <a href="https://gigsta.ai/contact-us" target="_blank">Contact Support</a>
            </div>
            <p>&copy; ${year} ${companyName} Inc.</p>
          </div>
        </div>
      </body>
      </html>
    `;
}

const sendMessageEmail = async (sender, receiver, conversation) => {
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

  const mailOptions = {
    from: `"${sender.username} via Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
    to: receiver.email,
    subject: `You have unread messages from ${sender.username}`,
    html: generateEmailTemplate(emailData)
  };

  await transporter.sendMail(mailOptions);
};

const createMessage = async (request, response) => {
  const { conversationID, description } = request.body;

  try {
    const message = new Message({
      conversationID,
      userID: request.userID,
      description
    })

    await message.save();
    await Conversation.findOneAndUpdate({ conversationID }, {
      $set: {
        readBySeller: request.isSeller,
        readByBuyer: !request.isSeller,
        lastMessage: description
      }
    }, { new: true });

    const conversation = await Conversation.findOne({ conversationID });

    const sender = await User.findOne({ _id: request.isSeller ? conversation.sellerID : conversation.buyerID });
    const receiver = await User.findOne({ _id: request.isSeller ? conversation.buyerID : conversation.sellerID });

    // console.log(sender, receiver, conversation, "sender & receiver");
    await sendMessageEmail(sender, receiver, conversation);
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
    const messages = await Message.find({ conversationID }).populate('userID', 'username image email');
    return response.send(messages);
  }
  catch ({ message, status = 500 }) {
    return response.status(status).send({
      error: true,
      message
    })
  }
}

module.exports = {
  createMessage,
  getMessages
}