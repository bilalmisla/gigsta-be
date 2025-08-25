const express = require('express');
const nodemailer = require('nodemailer');
const app = express.Router();

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendContactQueryEmail = async (name, email, subject, message) => {
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
        to: `${process.env.EMAIL_USER},cassie@gigsta.ai`,
        subject: `${subject}`,
        html: `
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" />
            </div>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
            <hr />
            <p>This message was sent from the contact form on <a href="${process.env.FRONTEND_URL}" target="_blank">Gigsta AI</a>.</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

app.post("/", async (request, response) => {
    const { name, email, subject, message } = request.body;
    try {
        await sendContactQueryEmail(name, email, subject, message);
        return response.status(200).send({
            error: false,
            message: "Email has been sent successfully!!"
        });
    }
    catch ({ message, status = 500 }) {
        return response.status(status).send({
            error: true,
            message
        })
    }
});

module.exports = app;