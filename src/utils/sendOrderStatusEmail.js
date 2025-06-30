// utils/sendOrderStatusEmail.js

const nodemailer = require('nodemailer');
const { formatTimestamp } = require('../utils');
const { generateEmailTemplate } = require('../utils/emailTemplates');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOrderStatusEmail = async (sender, receiver, gigTitle, newStatus, orderId) => {
    const emailData = {
        logoUrl: 'https://gigsta.ai/media/logo-black-text.png',
        notificationText: `${sender.username} has updated the order status`,
        senderName: sender.username,
        senderAvatar: sender.image,
        timestamp: formatTimestamp(),
        messageContent: `The order status for <strong>${gigTitle}</strong> has been updated to <strong>${newStatus}</strong>.`,
        replyUrl: sender.isSeller ? `${process.env.FRONTEND_URL}/seller/orders` : `${process.env.FRONTEND_URL}/buyer/orders`,
        companyName: 'Gigsta AI',
        year: new Date().getFullYear()
    };

    const mailOptions = {
        from: `"${sender.username} via Gigsta AI" <${process.env.EMAIL_USER}>`,
        to: receiver.email,
        subject: `Order Status Updated: ${gigTitle} ➔ ${newStatus}`,
        html: generateEmailTemplate(emailData)
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendOrderStatusEmail };
