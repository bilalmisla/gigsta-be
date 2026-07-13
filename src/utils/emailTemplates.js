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
     <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Order Confirmed 🎉
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            Thank you for choosing Gigsta.ai.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${buyerName}</strong>,
        </p>

        <p>
            Thank you for your order! Your purchase has been successfully confirmed and the seller has been notified.
        </p>

        <p>
            <strong>${sellerName}</strong> will begin working on your order as soon as possible.
        </p>

        <!-- Order Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Order ID</td>
                <td style="padding:12px 16px;">${orderId}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Gig</td>
                <td style="padding:12px 16px;">${gigTitle}</td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Seller</td>
                <td style="padding:12px 16px;">${sellerName}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Total Paid</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#16A34A;">
                    $${amount}
                </td>
            </tr>

        </table>

        <!-- Button -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${orderLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View My Order
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                📦 What's Next?
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                You can track your order's progress, communicate with <strong>${sellerName}</strong>, submit requirements, and receive your completed work directly from your Gigsta dashboard.
            </div>
        </div>

        <p style="margin-top:35px;">
            We appreciate your trust in Gigsta.ai and hope you have a fantastic experience!
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

    <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>
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
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            New Order Received 🎉
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            Congratulations! You have a new order.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${sellerName}</strong>,
        </p>

        <p>
            Great news! <strong>${buyerName}</strong> has placed an order for your gig.
        </p>

        <p>
            It's time to review the buyer's requirements and start delivering an amazing experience.
        </p>

        <!-- Order Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Order ID</td>
                <td style="padding:12px 16px;">${orderId}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Gig</td>
                <td style="padding:12px 16px;">${gigTitle}</td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Buyer</td>
                <td style="padding:12px 16px;">${buyerName}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Order Value</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#16A34A;">
                    $${amount}
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${orderLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View Order
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                🚀 Next Steps
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                Review the buyer's requirements, communicate if you need additional information, and begin working on the order as soon as possible. Keeping the buyer updated throughout the process helps build trust and earn great reviews.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for being part of the Gigsta.ai community. We can't wait to see your great work!
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

   <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>
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
     <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Withdrawal Request Received 💸
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            We've received your withdrawal request.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${sellerName}</strong>,
        </p>

        <p>
            Your withdrawal request has been successfully submitted and is currently being reviewed by our team.
        </p>

        <!-- Withdrawal Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Requested On</td>
                <td style="padding:12px 16px;">
                    ${new Date(requestedAt).toLocaleString()}
                </td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Amount</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#16A34A;">
                    $${amount}
                </td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Status</td>
                <td style="padding:12px 16px;">
                    <strong>${status}</strong>
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${dashboardLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View Withdrawals
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                ⏳ What's Next?
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                Our team will review your withdrawal request and verify your payment details. Once approved, the payment will be processed and your withdrawal status will be updated in your dashboard.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for being a valued member of the Gigsta.ai community.
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

    <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>
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
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Withdrawal Status Updated
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            Your withdrawal request has been processed.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${sellerName}</strong>,
        </p>

        <p>
            Your withdrawal request has been reviewed and its status has been updated.
        </p>

        <!-- Withdrawal Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Amount</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#16A34A;">
                    $${amount}
                </td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Status</td>
                <td style="padding:12px 16px;">
                    <strong>${status}</strong>
                </td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Processed On</td>
                <td style="padding:12px 16px;">
                    ${new Date(processedAt).toLocaleString()}
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${dashboardLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View Withdrawals
            </a>
        </div>

        <!-- Status Info -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                ℹ️ Status Update
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                Your withdrawal request is now marked as <strong>${status}</strong>. Visit your dashboard to view additional details and the latest payment information.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for using <strong>Gigsta.ai</strong>.
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

  <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>
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
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">
    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />
        <h2 style="margin:0;color:#111827;font-size:26px;">
            New Withdrawal Request
        </h2>
        <p style="margin:10px 0 0;color:#6b7280;">
            A seller has submitted a withdrawal request.
        </p>
    </div>
    <!-- Body -->
    <div style="padding:35px;">
        <p style="margin-top:0;font-size:16px;color:#374151;">
            Hello <strong>Admin</strong>,
        </p>
        <p style="font-size:15px;color:#6b7280;line-height:1.7;">
            A new withdrawal request has been submitted. Please review the details below before processing the payment.
        </p>
        <!-- Details Card -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Request ID</td>
                <td style="padding:12px 16px;">${requestId}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Full Name</td>
                <td style="padding:12px 16px;">${fullName}</td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Email</td>
                <td style="padding:12px 16px;">${email}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Account Holder</td>
                <td style="padding:12px 16px;">${accountHolderName}</td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Routing Number</td>
                <td style="padding:12px 16px;">${routingNumber}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Account Number</td>
                <td style="padding:12px 16px;">${accountNumber}</td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Account Type</td>
                <td style="padding:12px 16px;">${accountType}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Withdrawal Amount</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#16a34a;">
                    $${amount}
                </td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Country</td>
                <td style="padding:12px 16px;">${country}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">State</td>
                <td style="padding:12px 16px;">${state}</td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Address</td>
                <td style="padding:12px 16px;">${address}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Postal Code</td>
                <td style="padding:12px 16px;">${postalCode}</td>
            </tr>
            <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-weight:bold;">Requested At</td>
                <td style="padding:12px 16px;">${new Date(requestedAt).toLocaleString()}</td>
            </tr>
        </table>
          <div style="
    margin-top:30px;
    padding:20px;
    background:#FAFAFA;
    border:1px solid #E5E7EB;
    border-left:5px solid #08F0DF;
    border-radius:8px;
">
    <div style="
        font-size:16px;
        font-weight:600;
        color:#111827;
        margin-bottom:8px;
    ">
        📋 Review Required
    </div>

    <div style="
        color:#4B5563;
        font-size:14px;
        line-height:1.7;
    ">
        Please review this withdrawal request in the <strong>Gigsta Admin Dashboard</strong>.
        Verify the seller's banking details before approving and processing the payment.
    </div>
</div>
        
        <p style="margin-top:35px;color:#374151;">
            Regards,<br>
            <strong>Gigsta System</strong>
        </p>
    </div>
   <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>
</div>
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
<title>New Message</title>
</head>

<body style="margin:0;padding:30px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">

<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="${logoUrl}"
             alt="${companyName}"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            You Have a New Message 💬
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            ${notificationText}
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;font-size:16px;line-height:1.7;">

        <p style="margin-top:0;">
            You have received a new message on
            <strong>${companyName}</strong>.
        </p>

        <!-- Message Card -->
        <div style="
            margin:30px 0;
            border:1px solid #E5E7EB;
            border-radius:10px;
            overflow:hidden;
            background:#ffffff;
        ">

            <!-- Sender -->
            <div style="
                display:flex;
                align-items:center;
                padding:18px;
                background:#F9FAFB;
                border-bottom:1px solid #E5E7EB;
            ">

                <img src="${senderAvatar}"
                     alt="${senderName}"
                     style="
                        width:55px;
                        height:55px;
                        border-radius:50%;
                        object-fit:cover;
                        margin-right:15px;
                     ">

                <div>
                    <div style="
                        font-weight:600;
                        font-size:16px;
                        color:#111827;
                    ">
                        ${senderName}
                    </div>

                    <div style="
                        font-size:13px;
                        color:#6B7280;
                        margin-top:4px;
                    ">
                        ${timestamp}
                    </div>
                </div>

            </div>

            <!-- Message -->
            <div style="
                padding:22px;
                color:#4B5563;
                line-height:1.8;
                font-size:15px;
            ">
                ${messageContent}
            </div>

        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${replyUrl}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                Reply Now
            </a>
        </div>

    </div>

    <!-- Footer -->
    <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>

</body>
</html>
      `;
}

// 5️⃣ Send email to Buyer when seller requests delivery extension
const sendExtendDeliveryRequestEmail = async (
  email,
  buyerName,
  sellerName,
  gigTitle,
  orderId, gigId, conversationID,
  days,
  currentDeliveryDate,
  newDeliveryDate,
  transporter
) => {
  const orderLink = `${process.env.FRONTEND_URL}/buyer/orders/${orderId}/${conversationID}/${gigId}`;

  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⏰ Delivery Extension Request: "${gigTitle}"`,
    html: `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Delivery Extension Requested 📅
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            Your seller has requested additional time to complete your order.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${buyerName}</strong>,
        </p>

        <p>
            <strong>${sellerName}</strong> has requested to extend the delivery date for your order.
        </p>

        <p>
            Please review the request details below and decide whether you'd like to approve or reject the extension.
        </p>

        <!-- Extension Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Order ID</td>
                <td style="padding:12px 16px;">${orderId}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Gig</td>
                <td style="padding:12px 16px;">${gigTitle}</td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Seller</td>
                <td style="padding:12px 16px;">${sellerName}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Current Delivery</td>
                <td style="padding:12px 16px;">
                    ${new Date(currentDeliveryDate).toLocaleDateString()}
                </td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Extension Requested</td>
                <td style="padding:12px 16px;">
                    ${days} day${days > 1 ? 's' : ''}
                </td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">New Delivery Date</td>
                <td style="padding:12px 16px;font-weight:bold;color:#111827;">
                    ${new Date(newDeliveryDate).toLocaleDateString()}
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${orderLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                Review Request
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                📋 Action Required
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                Please review the seller's request in your order dashboard. You can choose to <strong>approve</strong> or <strong>reject</strong> the proposed delivery extension.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for using <strong>Gigsta.ai</strong>.
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

   <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

</div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// 6️⃣ Send email to Seller when buyer approves delivery extension
const sendExtendDeliveryApprovalEmail = async (
  email,
  sellerName,
  buyerName,
  gigTitle,
  orderId, gigId, conversationID,
  days,
  newDeliveryDate,
  transporter
) => {
  const orderLink = `${process.env.FRONTEND_URL}/seller/orders/${orderId}/${conversationID}/${gigId}`;

  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `✅ Delivery Extension Approved: "${gigTitle}"`,
    html: `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Extension Approved 🎉
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            Your delivery extension request has been approved.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${sellerName}</strong>,
        </p>

        <p>
            Great news! <strong>${buyerName}</strong> has approved your request to extend the delivery date for your order.
        </p>

        <!-- Extension Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Order ID</td>
                <td style="padding:12px 16px;">${orderId}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Gig</td>
                <td style="padding:12px 16px;">${gigTitle}</td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Buyer</td>
                <td style="padding:12px 16px;">${buyerName}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Extension Approved</td>
                <td style="padding:12px 16px;">
                    ${days} day${days > 1 ? 's' : ''}
                </td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">New Delivery Date</td>
                <td style="padding:12px 16px;font-weight:bold;color:#16A34A;">
                    ${new Date(newDeliveryDate).toLocaleDateString()}
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${orderLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View Order
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                ✅ Next Steps
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                Your new delivery deadline has been updated. Please complete and deliver the order on or before <strong>${new Date(newDeliveryDate).toLocaleDateString()}</strong> to ensure a smooth experience for your buyer.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for providing excellent service on <strong>Gigsta.ai</strong>.
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>

   <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>
</div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// 7️⃣ Send email to Seller when buyer rejects delivery extension
const sendExtendDeliveryRejectionEmail = async (
  email,
  sellerName,
  buyerName,
  gigTitle,
  orderId,
  gigId, conversationID,
  days,
  currentDeliveryDate,
  transporter
) => {
  const orderLink = `${process.env.FRONTEND_URL}/seller/orders/${orderId}/${conversationID}/${gigId}`;

  const mailOptions = {
    from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `❌ Delivery Extension Rejected: "${gigTitle}"`,
    html: `
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">

    <!-- Header -->
    <div style="padding:35px 20px;text-align:center;background:#fafafa;border-bottom:1px solid #ececec;">
        <img src="https://gigsta.ai/media/logo-black-text.png"
             alt="Gigsta AI"
             style="width:70px;height:70px;margin-bottom:10px;" />

        <h2 style="margin:0;color:#111827;font-size:26px;">
            Extension Request Declined
        </h2>

        <p style="margin:10px 0 0;color:#6b7280;">
            The buyer has declined your delivery extension request.
        </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 35px;color:#374151;line-height:1.7;font-size:16px;">

        <p style="margin-top:0;">
            Hi <strong>${sellerName}</strong>,
        </p>

        <p>
            <strong>${buyerName}</strong> has declined your request to extend the delivery date for the following order.
        </p>

        <!-- Extension Summary -->
        <table cellpadding="0" cellspacing="0" width="100%"
               style="margin:30px 0;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;overflow:hidden;font-size:15px;">

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;width:40%;">Order ID</td>
                <td style="padding:12px 16px;">${orderId}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Gig</td>
                <td style="padding:12px 16px;">${gigTitle}</td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Buyer</td>
                <td style="padding:12px 16px;">${buyerName}</td>
            </tr>

            <tr>
                <td style="padding:12px 16px;font-weight:bold;">Requested Extension</td>
                <td style="padding:12px 16px;">
                    ${days} day${days > 1 ? 's' : ''}
                </td>
            </tr>

            <tr style="background:#F9FAFB;">
                <td style="padding:12px 16px;font-weight:bold;">Current Delivery Date</td>
                <td style="padding:12px 16px;font-weight:bold;">
                    ${new Date(currentDeliveryDate).toLocaleDateString()}
                </td>
            </tr>

        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:35px 0;">
            <a href="${orderLink}"
               target="_blank"
               style="
                    background:#F10BAD;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:16px;
                    font-weight:bold;
                    padding:16px 40px;
                    border-radius:8px;
                    display:inline-block;
               ">
                View Order
            </a>
        </div>

        <!-- Info Card -->
        <div style="
            margin-top:30px;
            padding:20px;
            background:#FAFAFA;
            border:1px solid #E5E7EB;
            border-left:5px solid #08F0DF;
            border-radius:8px;
        ">
            <div style="
                font-size:16px;
                font-weight:600;
                color:#111827;
                margin-bottom:10px;
            ">
                📋 Next Steps
            </div>

            <div style="
                color:#4B5563;
                font-size:14px;
                line-height:1.7;
            ">
                The original delivery deadline remains in effect. Please complete and deliver your order by <strong>${new Date(currentDeliveryDate).toLocaleDateString()}</strong> to avoid delays or potential order issues.
            </div>
        </div>

        <p style="margin-top:35px;">
            Thank you for your continued commitment to providing quality service on <strong>Gigsta.ai</strong>.
        </p>

        <p style="margin-top:40px;">
            Best regards,<br>
            <strong>Gigsta Team</strong>
        </p>

    </div>
    <div style="
        padding:20px;
        background:#fafafa;
        border-top:1px solid #ececec;
        text-align:center;
        font-size:13px;
        color:#9CA3AF;
    ">

        <div style="margin-bottom:12px;">
            <a href="https://gigsta.ai/privacy-policy"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Privacy Policy
            </a>

            |

            <a href="https://gigsta.ai/contact-us"
               style="color:#6B7280;text-decoration:none;margin:0 12px;">
                Contact Support
            </a>
        </div>

        © ${year} ${companyName}. All rights reserved.

    </div>

   
</div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendBuyerOrderConfirmationEmail, sendSellerOrderNotificationEmail, generateEmailTemplate,
  sendSellerWithdrawalNotificationEmail, sendSellerWithdrawalStatusUpdateEmail, sendAdminWithdrawalNotificationEmail,
  sendExtendDeliveryRequestEmail, sendExtendDeliveryApprovalEmail, sendExtendDeliveryRejectionEmail
}
