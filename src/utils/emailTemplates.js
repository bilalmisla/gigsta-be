// 1️⃣ Send email to Buyer after order is placed
const sendBuyerOrderConfirmationEmail = async (
  email,
  buyerName,
  gigTitle,
  sellerName,
  orderId,
  amount,
  deliveryTime,
  transporter
) => {
  const orderLink = `${process.env.FRONTEND_URL}/orders`;

  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `✅ Order Confirmed! Your gig "${gigTitle}" is in progress`,
    html: `
            <p><strong>Hi ${buyerName},</strong></p>
            <p>Thank you for your order on <a href="${process.env.FRONTEND_URL}" target="_blank">Gigsta.ai</a>!</p>
            <p>Your order for <strong>"${gigTitle}"</strong> has been successfully placed. The seller <strong>${sellerName}</strong> has received the order and will begin working on it soon.</p>

            <h3>🛒 Order Summary</h3>
            <ul>
                <li><strong>Order ID:</strong> ${orderId}</li>
                <li><strong>Seller:</strong> ${sellerName}</li>
                <li><strong>Total:</strong> $${amount}</li>
            </ul>

            <p>You can manage your order and contact the seller any time via your dashboard:</p>
            <p><a href="${orderLink}" target="_blank">View My Order</a></p>

            <p>Thank you for choosing Gigsta. We hope this experience exceeds your expectations!</p>
            <p>Best regards,<br />Gigsta Team</p>
        `
  };

  await transporter.sendMail(mailOptions);
};

// 2️⃣ Send email to Seller when new order is placed
const sendSellerOrderNotificationEmail = async (
  email,
  sellerName,
  gigTitle,
  buyerName,
  orderId,
  amount,
  deliveryTime,
  transporter
) => {
  const orderLink = `${process.env.FRONTEND_URL}/orders`;

  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `🚀 New Order Received: "${gigTitle}"`,
    html: `
            <p><strong>Hi ${sellerName},</strong></p>
            <p>You’ve received a new order on <a href="${process.env.FRONTEND_URL}" target="_blank">Gigsta.ai</a>!</p>
            <p>Buyer <strong>${buyerName}</strong> has purchased your gig: <strong>"${gigTitle}"</strong>.</p>

            <h3>📦 Order Details</h3>
            <ul>
                <li><strong>Order ID:</strong> ${orderId}</li>
                <li><strong>Buyer:</strong> ${buyerName}</li>
                <li><strong>Amount:</strong> $${amount}</li>
            </ul>

            <p>Make sure to review the requirements and get started promptly.</p>
            <p><a href="${orderLink}" target="_blank">Go to Order Page</a></p>

            <p>We’re excited to see your creativity in action. Let us know if you need any help!</p>
            <p>Best regards,<br />Gigsta Team</p>
        `
  };

  await transporter.sendMail(mailOptions);
};

// 3️⃣ Send email to Seller when withdrawal is requested
const sendSellerWithdrawalNotificationEmail = async (
  email,
  sellerName,
  amount,
  status,
  requestedAt,
  transporter
) => {
  const dashboardLink = `${process.env.FRONTEND_URL}/seller/withdrawals`;
  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `💸 Withdrawal Request Received`,
    html: `
            <p><strong>Hi ${sellerName},</strong></p>
            <p>We have received your withdrawal request on <strong>${new Date(requestedAt).toLocaleString()}</strong>.</p>
            <ul>
                <li><strong>Amount:</strong> $${amount}</li>
                <li><strong>Status:</strong> ${status}</li>
            </ul>
            <p>You can track the status of your withdrawal in your dashboard:</p>
            <p><a href="${dashboardLink}" target="_blank">View Withdrawals</a></p>
            <p>Thank you for using Gigsta!</p>
            <p>Best regards,<br />Gigsta Team</p>
        `
  };
  await transporter.sendMail(mailOptions);
};

// 4️⃣ Send email to Seller when withdrawal is approved or rejected
const sendSellerWithdrawalStatusUpdateEmail = async (
  email,
  sellerName,
  amount,
  status,
  processedAt,
  transporter
) => {
  const dashboardLink = `${process.env.FRONTEND_URL}/seller/withdrawals`;
  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Withdrawal ${status === 'Approved' ? 'Approved' : 'Rejected'}`,
    html: `
            <p><strong>Hi ${sellerName},</strong></p>
            <p>Your withdrawal request for <strong>$${amount}</strong> has been <strong>${status}</strong> on <strong>${new Date(processedAt).toLocaleString()}</strong>.</p>
            <p>You can view the details in your dashboard:</p>
            <p><a href="${dashboardLink}" target="_blank">View Withdrawals</a></p>
            <p>Best regards,<br />Gigsta Team</p>
        `
  };
  await transporter.sendMail(mailOptions);
};

const sendAdminWithdrawalNotificationEmail = async (
  adminEmail,
  {
    fullName,
    email,
    address,
    postalCode,
    country, state,
    accountHolderName,
    routingNumber, accountNumber, accountType,
    amount,
    requestId,
    requestedAt
  },
  transporter
) => {
  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `📢 New Withdrawal Request by ${fullName}`,
    html: `
      <p><strong>Admin,</strong></p>
      <p>A new withdrawal request has been submitted by a seller. Here are the details:</p>
      <ul>
          <li><strong>Request ID:</strong> ${requestId}</li>
          <li><strong>Full Name:</strong> ${fullName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Account Holder Name:</strong> ${accountHolderName}</li>
          <li><strong>Routing Number:</strong> ${routingNumber}</li>
          <li><strong>Account Number:</strong> ${accountNumber}</li>
          <li><strong>Account Type:</strong> ${accountType}</li>
          <li><strong>Amount:</strong> $${amount}</li>
          <li><strong>Country:</strong> ${country}</li>
          <li><strong>State:</strong> ${state}</li>
          <li><strong>Address:</strong> ${address}</li>
          <li><strong>Postal Code:</strong> ${postalCode}</li>
          <li><strong>Requested At:</strong> ${new Date(requestedAt).toLocaleString()}</li>
      </ul>
      <p>Please review the request in the admin dashboard.</p>
      <p>Regards,<br />Gigsta System</p>
    `
  };

  await transporter.sendMail(mailOptions);
};

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

module.exports = {
  sendBuyerOrderConfirmationEmail, sendSellerOrderNotificationEmail, generateEmailTemplate,
  sendSellerWithdrawalNotificationEmail, sendSellerWithdrawalStatusUpdateEmail, sendAdminWithdrawalNotificationEmail
}
