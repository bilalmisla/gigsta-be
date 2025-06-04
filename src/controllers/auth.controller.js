const { User, Review, Order, Message, Conversation, Gig } = require('../models');
const { CustomException } = require('../utils');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { OAuth2Client } = require("google-auth-library");
const { default: axios } = require('axios');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sendVerificationEmail = async (email, username, token) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: 'Action Required: Verify Your Email Address',
        html: `
            <p><strong>Hi ${username},</strong></p>
            <p>Thank you for signing up for <a href=${process.env.FRONTEND_URL} target="_blank">Gigsta.ai</a>! Please verify your email by clicking the link below:</p>
            <p><a href="${verificationUrl}" target="_blank">${verificationUrl}</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendResetPasswordEmail = async (email, username, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: 'Reset Your Password',
        html: `
            <p>Hello <strong>${username}</strong>,</p>
            <p>We received a request to reset your password. Please click the link below to reset it:</p>
            <p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>
            <p>If you did not request this, you can safely ignore this email. This link will expire in 24 hours.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendConfirmationUpdateEmail = async (email, username, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/update-email?token=${token}`;
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: 'Update Your Email',
        html: `
            <p>Hello <strong>${username}</strong>,</p>
            <p>We received a request to update your email. Please click the link below to update it:</p>
            <p><a href="${resetUrl}" target="_blank" style="padding: 12px 20px; color: #ffffff; text-decoration: none; background-color: #f10Bad; border-radius: 10px;">Update Your Email</a></p>
            <p>If you did not request this, you can safely ignore this email. This link will expire in 24 hours.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendConfirmAccountCreatedEmail = async (email, username) => {
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: `Welcome to Gigsta AI, ${username}!`,
        html: `
            <p>Hi <strong>${username}</strong>,</p>
            <p>Welcome to <a href="${process.env.FRONTEND_URL}" target="_blank">Gigsta AI</a>! We're excited to have you on board.</p>
            <p>Start exploring amazing gigs, connecting with top freelancers, and getting work done effortlessly.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

const sendAccountDeletedEmail = async (email, username) => {
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: `Delete account, ${username}!`,
        html: `
            <p>Hi <strong>${username}</strong>,</p>
            <p>As per your request, your Gigsta.AI account was deleted.</p>
            <p>We wish you best of luck moving forward.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

const authRegister = async (request, response) => {
    const { username, email, phone, password, image, isSeller, description } = request.body;

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return response.status(400).send({
                error: true,
                message: 'Email already exists!'
            });
        }

        const user = new User({
            username,
            email,
            password: hash,
            image,
            description,
            isSeller,
            // phone,
            isVerified: false // Add an isVerified field in your User model
        });

        const savedUser = await user.save();

        // Generate a verification token
        const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Send verification email
        await sendVerificationEmail(email, username, token);

        return response.status(201).send({
            error: false,
            message: 'A verification email has been sent to your registered address.'
        });
    } catch (err) {
        if (err.message.includes('E11000')) {
            return response.status(400).send({
                error: true,
                message: 'Choose a unique username!'
            });
        }

        return response.status(500).send({
            error: true,
            message: err.message
        });
    }
};

const verifyEmail = async (request, response) => {
    const { token } = request.query;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return response.status(400).send({
                error: true,
                message: 'Invalid token or user does not exist.'
            });
        }

        if (user.isVerified) {
            return response.status(409).send({
                error: true,
                message: 'User is already verified.'
            });
        }

        user.isVerified = true;
        await user.save();

        return response.status(200).send({
            error: false,
            message: 'Your account has been successfully verified.'
        });
    } catch (err) {
        return response.status(400).send({
            error: true,
            message: 'Invalid or expired token.'
        });
    }
};

// HANDLE LOGIN WITH SOCIAL LINKS

const authLogin = async (req, res) => {
    const { username, password, credential } = req.body;

    try {
        if (credential) {
            return await handleSocialLogin(credential, res);
        }
        return await handleDefaultLogin(username, password, res);
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

const handleSocialLogin = async (credential, res) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        let user = await User.findOne({
            email: payload.email,
            deletedAt: { $ne: null }
        })
        .setOptions({ bypassDeletedCheck: true })
        .select('+deletedAt')
        .exec();

        if (user) {
            user.deletedAt = null;
            user.googleId = payload.sub;
            user.username = payload.name;
            user.image = payload.picture;
            user.isVerified = payload.email_verified;
            await user.save();

            await restoreRelatedRecords(user._id);
            return sendSuccessResponse(user, res);
        }

        user = await User.findOne({ email: payload.email, deletedAt: null });

        if (!user) {
            user = new User({
                username: payload.name,
                email: payload.email,
                image: payload.picture,
                isVerified: payload.email_verified,
                googleId: payload.sub,
            });
            await user.save();
            await sendConfirmAccountCreatedEmail(user.email, user.username);

            console.log("Created new user:", user);
            return sendSuccessResponse(user, res);
        }

        Object.assign(user, {
            username: payload.name,
            email: payload.email,
            image: payload.picture,
            isVerified: payload.email_verified,
            googleId: payload.sub,
        });
        await user.save();

        console.log("Updated existing user:", user);
        return sendSuccessResponse(user, res);
    } catch (error) {
        console.error("Error in handleSocialLogin:", error);
        return sendErrorResponse(res, 500, "Internal server error");
    }
};

const handleDefaultLogin = async (username, password, res) => {
    const user = await User.findOne({ username });
    if (!user) throw CustomException('Check username or password!', 404);

    if (!user.isVerified) {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        await sendVerificationEmail(user.email, username, token);
        return res.status(403).send({ error: true, message: 'Please verify your email before logging in.' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
        throw CustomException('Check username or password!', 404);
    }

    return sendSuccessResponse(user, res);
};

const sendSuccessResponse = (user, res) => {
    const { password, ...userData } = user._doc;
    const token = jwt.sign({ _id: user._id, isSeller: user.isSeller }, process.env.JWT_SECRET, { expiresIn: '7 days' });
    
    const cookieConfig = {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 60 * 60 * 24 * 7 * 1000,
        path: '/'
    };

    return res.cookie('accessToken', token, cookieConfig)
        .status(202)
        .send({ error: false, message: 'Success!', user: { ...userData, token } });
};

// HANDLE LOGIN WITH SOCIAL LINKS

const authResetPassword = async (request, response) => {
    const { email } = request.body;

    try {
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return response.status(404).send({
                error: true,
                message: 'Email does not exists!'
            });
        }

        // Generate a verification token
        const token = jwt.sign({ userId: existingUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Send verification email
        await sendResetPasswordEmail(email, existingUser.username, token);

        return response.status(201).send({
            error: false,
            message: 'A password reset email has been sent to your registered address.'
        });
    } catch (err) {
        if (err.message.includes('E11000')) {
            return response.status(400).send({
                error: true,
                message: 'Choose a unique email!'
            });
        }

        return response.status(500).send({
            error: true,
            message: err.message
        });
    }
};

const authConfirmPassword = async (request, response) => {
    const { token } = request.query;
    const { new_password } = request.body;
    try {
        const hash = await bcrypt.hash(new_password, saltRounds);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return response.status(400).send({
                error: true,
                message: 'Invalid token or user does not exist.'
            });
        }

        user.password = hash;
        await user.save();

        return response.status(200).send({
            error: false,
            message: 'Your password has been successfully changed.'
        });
    } catch (err) {
        return response.status(400).send({
            error: true,
            message: 'Invalid or expired token.'
        });
    }
}

const authLogout = async (request, response) => {
    return response.clearCookie('accessToken', {
        sameSite: 'none',
        secure: true
    })
        .send({
            error: false,
            message: 'User have been logged out!'
        });
}

const authStatus = async (request, response) => {
    try {
        const user = await User.findOne({ _id: request.userID }).select('-password');
        if (!user) {
            throw CustomException('User not found!', 404);
        }

        return response.send({
            error: false,
            message: 'Success!',
            user: { ...user._doc, token: request.token }
        })
    }
    catch (error) {
        return response.status(error.status).send({
            error: true,
            message: error.message
        })
    }
}

const authUpdatePassword = async (request, response) => {
    const { password, new_password } = request.body;
    try {
        const user = await User.findOne({ _id: request.userID });
        if (!user) {
            throw CustomException('User not found!', 404);
        }

        const match = bcrypt.compareSync(password, user.password);
        if (match) {
            const hash = await bcrypt.hash(new_password, saltRounds);

            user.password = hash;
            await user.save();

            return response.status(200).send({
                error: false,
                message: 'Your password has been successfully updated.'
            });
        } else {
            throw CustomException('Your current password is not valid!', 404);
        }
    } catch (error) {
        return response.status(error.status).send({
            error: true,
            message: error.message
        })
    }
}

const authUpdateProfile = async (request, response) => {
    const { username, email, description, image } = request.body;
    try {
        const user = await User.findOne({ _id: request.userID }).select('-password');
        if (!user) {
            throw CustomException('User not found!', 404);
        }
        let responseMsg = '';

        if (email !== user.email) {
            // Generate a verification token
            const token = jwt.sign({ userId: user._id, email: email }, process.env.JWT_SECRET, { expiresIn: '1d' });

            // Send verification email
            await sendConfirmationUpdateEmail(email, username, token);
            responseMsg = "Your profile has been successfully updated. A confirmation email has been sent to your registered address."
        } else {
            responseMsg = "Your profile has been successfully updated."
        }

        user.username = username;
        user.description = description;
        user.image = image;
        const updatedUser = await user.save();

        return response.status(200).send({
            error: false,
            message: responseMsg,
            user: { ...updatedUser._doc, token: request.token }
        });
    } catch (error) {
        return response.status(error.status).send({
            error: true,
            message: error.message
        })
    }
}

const authUpdateEmail = async (request, response) => {
    const { token } = request.query;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return response.status(400).send({
                error: true,
                message: 'Invalid token or user does not exist.'
            });
        }

        user.email = decoded.email;
        await user.save();

        return response.status(200).send({
            error: false,
            message: 'Your email has been successfully updated.',
            // user: { ...updatedUser._doc },
        });
    } catch (err) {
        return response.status(400).send({
            error: true,
            message: 'Invalid or expired token.'
        });
    }
};

const authDeleteAccount = async (request, response) => {
    try {
        const user = await User.findOne({ _id: request.userID });
        if (!user) {
            throw CustomException('User not found!', 404);
        }

        const currentTime = Date.now();

        if (user.isSeller) {
            // Soft delete gigs by user
            await Gig.updateMany({ userID: user._id }, { deletedAt: currentTime });

            // Soft delete conversations by user
            await Conversation.updateMany({ sellerID: user._id }, { deletedAt: currentTime });

            // Soft delete orders by user
            await Order.updateMany({ buyerID: user._id }, { deletedAt: currentTime });
        } else {
            // Soft delete conversations by user
            await Conversation.updateMany({ buyerID: user._id }, { deletedAt: currentTime });

            // Soft delete orders by user
            await Order.updateMany({ buyerID: user._id }, { deletedAt: currentTime });
        }

        // Soft delete related records
        await Message.updateMany({ userID: user._id }, { deletedAt: currentTime }); // Soft delete messages by user
        await Review.updateMany({ userID: user._id }, { deletedAt: currentTime }); // Soft delete reviews by user

        await sendAccountDeletedEmail(user?.email, user?.username);

        // Soft delete the user
        await User.findByIdAndUpdate(user._id, { deletedAt: currentTime });


        return response.status(200).send({
            error: false,
            message: 'Your account has been successfully deleted.'
        });
    } catch (error) {
        return response.status(error.status || 500).send({
            error: true,
            message: error.message
        });
    }
};

// const FACEBOOK_APP_ID = "455920190822400";
// const FACEBOOK_APP_SECRET = "b08b39fedd93fe891009b21f7b4b0854";
// const REDIRECT_URI = "http://localhost:8080/api/auth/facebook/callback";

// const signInWithFacebook = async (req, res) => {
//     try {
//         const { code } = req.query;

//         // 1️⃣ Exchange 'code' for an access token
//         const tokenResponse = await axios.get(
//             `https://graph.facebook.com/v18.0/oauth/access_token`,
//             {
//                 params: {
//                     client_id: FACEBOOK_APP_ID,
//                     client_secret: FACEBOOK_APP_SECRET,
//                     redirect_uri: REDIRECT_URI,
//                     code,
//                 },
//             }
//         );

//         const accessToken = tokenResponse.data.access_token;

//         // 2️⃣ Fetch user details
//         const userResponse = await axios.get(
//             `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
//         );

//         const { id, name, email } = userResponse.data;

//         // 3️⃣ Check if user exists, else save in MongoDB
//         let user = await User.findOne({ facebookId: id });

//         if (!user) {
//             user = new User({ facebookId: id, name, email });
//             await user.save();
//         }

//         // 4️⃣ Redirect user to frontend with success message
//         res.redirect(`${process.env.FRONTEND_URL}/dashboard?userId=${user._id}`);
//     } catch (error) {
//         console.error("Facebook OAuth Error:", error.response?.data || error);
//         res.status(500).json({ error: "Authentication failed" });
//     }
// }
const signInWithFacebook = async (req, res) => {
    const { accessToken, userID } = req.body;

    try {
        const facebookVerifyUrl = `https://graph.facebook.com/${userID}?fields=id,name,email,picture&access_token=${accessToken}`;
        const response = await axios.get(facebookVerifyUrl);

        if (!response.data.email) {
            throw new Error("Email permission not granted by user.");
        }

        console.log("Facebook User:", response.data);
        res.status(200).json({ success: true, user: response.data });
    } catch (error) {
        console.error("Facebook Auth Error:", error);
        res.status(401).json({ success: false, message: error.message || "Invalid Facebook Token" });
    }
}

const restoreRelatedRecords = async (userId) => {
    try {
        // Restore Gigs
        await Gig.updateMany({ userID: userId, deletedAt: { $ne: null } }, { deletedAt: null })
        .setOptions({ bypassDeletedCheck: true }) // This prevents the pre-find middleware from running
        .select('+deletedAt')
        .exec();;

        // Restore Conversations
        await Conversation.updateMany(
            { $or: [{ sellerID: userId }, { buyerID: userId }], deletedAt: { $ne: null } },
            { deletedAt: null }
        ).setOptions({ bypassDeletedCheck: true }) // This prevents the pre-find middleware from running
        .select('+deletedAt')
        .exec();

        // Restore Orders
        await Order.updateMany(
            { $or: [{ sellerID: userId }, { buyerID: userId }], deletedAt: { $ne: null } },
            { deletedAt: null }
        )
        .setOptions({ bypassDeletedCheck: true }) // This prevents the pre-find middleware from running
        .select('+deletedAt')
        .exec();

        // Restore Messages
        await Message.updateMany({ userID: userId, deletedAt: { $ne: null } }, { deletedAt: null })
        .setOptions({ bypassDeletedCheck: true }) // This prevents the pre-find middleware from running
        .select('+deletedAt')
        .exec();

        // Restore Reviews
        await Review.updateMany({ userID: userId, deletedAt: { $ne: null } }, { deletedAt: null })
        .setOptions({ bypassDeletedCheck: true }) // This prevents the pre-find middleware from running
        .select('+deletedAt')
        .exec();

        console.log("Restored all related records for user:", userId);
    } catch (error) {
        console.error("Error restoring related records:", error);
        throw error; // Propagate the error to handle it in the main function
    }
};

const handleFetchProfile = async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username });
        if (!user) {
            throw CustomException('User not found!', 404);
        }

        const gigs = await Gig.find({ userID: user._id });

        return res.status(200).json({ success: true, user, gigs });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

module.exports = {
    authLogin,
    authLogout,
    authRegister,
    authStatus,
    verifyEmail,
    authResetPassword, authConfirmPassword, authUpdatePassword,
    authUpdateProfile, authUpdateEmail, authDeleteAccount, signInWithFacebook, handleFetchProfile
}