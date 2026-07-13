const { User, Review, Order, Message, Conversation, Gig, OrderStatus, Coupon } = require('../models');
const { CustomException } = require('../utils');
const { generateRegistrationVerificationEmailHtml } = require('../utils/emailTemplates');
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

const sendVerificationEmail = async (email, username, token, fullname) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const displayName = fullname || username;
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Action Required: Verify Your Email Address',
        html: `
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 50px; height: 50px;" />
            </div>
            <p><strong>Hi ${username},</strong></p>
            <p style="display: flex; align-items: center; flex-direction: column; gap: 10px;">
              <p>Your username is:</p>
              <strong style="background-color: #f10Bad; color: #ffffff; padding: 14px 24px; border-radius: 8px;">${username}</strong>
            </p>
            <p>Thank you for signing up for <a href=${process.env.FRONTEND_URL} target="_blank">Gigsta.ai</a>! Please verify your email by clicking the link below:</p>
            <p><a href="${verificationUrl}" style="style="
            background-color:#f10bad;
                                              font-size: 15px;
                                              color: #ffffff;
                                              text-decoration: none;
                                              font-weight: 700;
                                              padding: 14px 30px;
                                              display: block;text-transform: uppercase;
                                            " target="_blank">Verify Your Account</a></p>
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
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 50px; height: 50px;" />
            </div>
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
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 50px; height: 50px;" />
            </div>
            <p>Hello <strong>${username}</strong>,</p>
            <p>We received a request to update your email. Please click the link below to update it:</p>
            <p><a href="${resetUrl}" target="_blank" style="padding: 12px 20px; color: #ffffff; text-decoration: none; background-color: #f10Bad; border-radius: 10px;">Update Your Email</a></p>
            <p>If you did not request this, you can safely ignore this email. This link will expire in 24 hours.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendConfirmAccountCreatedEmail = async (email, username, couponCode) => {
    const mailOptions = {
        from: `"Gigsta AI" <${process.env.EMAIL_USER}>`, // Replace with your app name and email
        to: email,
        subject: `Welcome to Gigsta AI, ${username}!`,
        html: `
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 50px; height: 50px;" />
            </div>
            <p>Hi <strong>${username}</strong>,</p>
            <p>Welcome to <a href="${process.env.FRONTEND_URL}" target="_blank">Gigsta AI</a>! We're excited to have you on board.</p>
            <p>Start exploring amazing gigs, connecting with top freelancers, and getting work done effortlessly.</p>
            ${couponCode ? `<p style="padding: 15px; background-color: #f10Bad; color: white; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0;">As a welcome gift, use code <strong>${couponCode}</strong> for 10% off your first checkout!</p>` : ''}
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
            <div class="logo">
              <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 50px; height: 50px;" />
            </div>
            <p>Hi <strong>${username}</strong>,</p>
            <p>As per your request, your Gigsta.AI account was deleted.</p>
            <p>We wish you best of luck moving forward.</p>
            <p>Best regards, <br /> Gigsta Team</p>
        `
    };

    await transporter.sendMail(mailOptions);
}

const generateUniqueUsername = async (fullname) => {
    // Build a clean base: lowercase, remove non-alphanumeric, max 12 chars
    const base = fullname
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12) || 'user';

    let username;
    let attempts = 0;
    do {
        // Fresh random 3-digit number on every attempt
        const randomNum = Math.floor(100 + Math.random() * 900);
        username = `${base}${randomNum}`;
        const existing = await User.findOne({ username });
        if (!existing) break;
        attempts++;
    } while (attempts < 10);

    return username;
};

const authRegister = async (request, response) => {
    const { email, phone, password, image, isSeller, description, fullname } = request.body;

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return response.status(400).send({
                error: true,
                message: 'Email already exists!'
            });
        }

        // Auto-generate a unique username from fullname + random number
        const username = await generateUniqueUsername(fullname);

        const user = new User({
            username,
            email,
            password: hash,
            image,
            description,
            isSeller,
            fullname,
            // phone,
            isVerified: false // Add an isVerified field in your User model
        });

        const savedUser = await user.save();

        // Generate a verification token
        const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Send verification email
        await sendVerificationEmail(email, username, token, fullname);

        return response.status(201).send({
            error: false,
            message: 'A verification email has been sent to your registered address.'
        });
    } catch (err) {
        if (err.message.includes('E11000')) {
            return response.status(400).send({
                error: true,
                message: err.message || 'Choose a unique username!'
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

        let couponCode = null;
        if (!user.isSeller) {
            couponCode = `WELCOME-${user._id.toString().slice(-6).toUpperCase()}`;
            const couponExists = await Coupon.findOne({ code: couponCode });
            if (!couponExists) {
                const newCoupon = new Coupon({
                    code: couponCode,
                    discountPercent: 10,
                    isActive: true,
                    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) // 1 year expiry
                });
                await newCoupon.save();
            }
        }

        await sendConfirmAccountCreatedEmail(user.email, user.username, couponCode);

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
    const { username, password, credential, isSeller } = req.body;

    try {
        if (credential) {
            return await handleSocialLogin(credential, isSeller, res);
        }
        return await handleDefaultLogin(username, password, res);
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

const authAdminLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        return await handleDefaultAdminLogin(username, password, res);
    } catch ({ message, status = 500 }) {
        return res.status(status).send({ error: true, message });
    }
};

const handleSocialLogin = async (credential, isSeller, res) => {
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
            user.username = payload.name.toLowerCase();
            user.image = payload.picture;
            user.isVerified = payload.email_verified;
            user.isSeller = isSeller;
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
                isSeller
            });
            await user.save();

            let couponCode = null;
            if (!user.isSeller) {
                couponCode = `WELCOME-${user._id.toString().slice(-6).toUpperCase()}`;
                const newCoupon = new Coupon({
                    code: couponCode,
                    discountPercent: 10,
                    isActive: true,
                    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                });
                await newCoupon.save();
            }

            await sendConfirmAccountCreatedEmail(user.email, user.username, couponCode);

            console.log("Created new user:", user);
            return sendSuccessResponse(user, res);
        }

        Object.assign(user, {
            username: payload.name,
            email: payload.email,
            image: payload.picture,
            isVerified: payload.email_verified,
            googleId: payload.sub,
            isSeller
        });
        await user.save();

        console.log("Updated existing user:", user);
        return sendSuccessResponse(user, res);
    } catch (error) {
        console.error("Error in handleSocialLogin:", error);
        // return sendErrorResponse(res, 500, "Internal server error");
        return res.status(500).send({
            error: true,
            message: error.message || "Internal server error"
        });
    }
};

const handleDefaultLogin = async (username, password, res) => {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) throw CustomException('Check username or password!', 404);

    if (!user.isVerified) {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        await sendVerificationEmail(user.email, user.username, token, user.fullname);
        return res.status(403).send({ error: true, message: 'Please verify your email before logging in.' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
        throw CustomException('Check username or password!', 404);
    }

    return sendSuccessResponse(user, res);
};

const handleDefaultAdminLogin = async (username, password, res) => {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) throw CustomException('Check username or password!', 404);

    if (!user.isVerified) {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        await sendVerificationEmail(user.email, user.username, token, user.fullname);
        return res.status(403).send({ error: true, message: 'Please verify your email before logging in.' });
    }

    // Check if user's role is admin
    if (!user.role || user.role.toLowerCase() !== "admin") {
        return res.status(403).send({ error: true, message: 'Access denied. Admins only.' });
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
    const { username, email, description, tagline, image, fullname, postalCode, address, country, state } = request.body;
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

        user.username = username.toLowerCase();
        user.description = description;
        user.image = image;
        user.tagline = tagline;
        user.fullname = fullname;
        user.postalCode = postalCode;
        user.address = address;
        user.country = country;
        user.state = state;
        
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
        const user = await User.findById(request.userID);
        if (!user) {
            return response.status(404).send({
                error: true,
                message: "User not found!",
            });
        }

        const { password } = request.body;
        if (!password) {
            return response.status(400).send({
                error: true,
                message: "Password is required to delete your account.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return response.status(401).send({
                error: true,
                message: "Incorrect password.",
            });
        }

        const currentTime = Date.now();

        if (user.isSeller) {
            await Gig.updateMany({ userID: user._id }, { deletedAt: currentTime });
            await Conversation.updateMany({ sellerID: user._id }, { deletedAt: currentTime });
            await Order.updateMany({ sellerID: user._id }, { deletedAt: currentTime });
        } else {
            await Conversation.updateMany({ buyerID: user._id }, { deletedAt: currentTime });
            await Order.updateMany({ buyerID: user._id }, { deletedAt: currentTime });
        }

        await Message.updateMany({ userID: user._id }, { deletedAt: currentTime });
        await Review.updateMany({ userID: user._id }, { deletedAt: currentTime });

        await sendAccountDeletedEmail(user.email, user.username);

        await User.findByIdAndUpdate(user._id, { deletedAt: currentTime });

        return response.status(200).send({
            error: false,
            message: "Your account has been successfully deleted.",
        });
    } catch (error) {
        console.error("Account deletion failed:", error);
        return response.status(500).send({
            error: true,
            message: error.message || "Internal server error.",
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

        const gigs = await Gig.find({ userID: user._id }).populate('userID', 'username fullname cover email description isSeller _id image');
        let ordersCount;
        if (user.isSeller) {
            const orderStatuses = await OrderStatus.find({ sellerID: user._id, status: "Completed" });
            ordersCount = orderStatuses.length;
        } else {
            const orderStatuses = await OrderStatus.find({ buyerID: user._id, status: "Completed" });
            ordersCount = orderStatuses.length;
        }

        return res.status(200).json({ success: true, user: { ...user._doc, ordersCompleted: ordersCount }, gigs });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const handleFetchEarnings = async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            throw CustomException('User not found!', 404);
        }

        // 1. Find all OrderStatus for this seller
        const orderStatuses = await OrderStatus.find({ sellerID: user._id, deletedAt: null });

        // 2. Group by orderID+gigID to get latest status for each gig in each order
        const latestStatusMap = {};
        orderStatuses.forEach(status => {
            const key = `${status.orderID}_${status.gigID}`;
            if (!latestStatusMap[key] || new Date(status.createdAt) > new Date(latestStatusMap[key].createdAt)) {
                latestStatusMap[key] = status;
            }
        });

        let totalEarnings = 0;

        // Fetch all relevant orders
        const orderIDs = Array.from(new Set(Object.values(latestStatusMap).map(s => s.orderID)));
        const orders = await Order.find({ _id: { $in: orderIDs } });
        const orderMap = {};
        orders.forEach(order => { orderMap[order._id.toString()] = order; });

        Object.values(latestStatusMap).forEach(status => {
            const order = orderMap[status.orderID?.toString()];
            if (!order) return;

            const gigItem = order.gigs.find(g =>
                g.gigID.toString() === status.gigID.toString() &&
                g.sellerID.toString() === user._id.toString()
            );
            if (!gigItem) return;
            const amount = gigItem.total || gigItem.price || 0;

            // Accumulate amounts and group statuses
            if (status.status === 'Completed') {
                totalEarnings += amount;
            }
        });

        // Return the response in the requested format
        return res.send({ totalEarnings });
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
    authResetPassword, authConfirmPassword, authUpdatePassword, handleFetchEarnings,
    authUpdateProfile, authUpdateEmail, authDeleteAccount, signInWithFacebook, handleFetchProfile,
    authAdminLogin
}