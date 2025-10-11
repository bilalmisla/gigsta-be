const { StudentInvite, User } = require('../models');
const { CustomException } = require('../utils');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send invite email to students
const sendStudentInviteEmail = async (email, invitedByName, inviteToken) => {
    const inviteUrl = `${process.env.FRONTEND_URL}/signup?invite=${inviteToken}`;
    
    const mailOptions = {
        from: `"${invitedByName} via Gigsta AI" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `You're invited to join Gigsta AI as a Student`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://gigsta.ai/media/logo-black-text.png" alt="Gigsta AI Logo" style="width: 80px; height: 80px;" />
                </div>
                
                <h2 style="color: #333; text-align: center; margin-bottom: 20px;">You're Invited to Join Gigsta AI!</h2>
                
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Hi there! <strong>${invitedByName}</strong> has invited you to join Gigsta AI as a student.
                </p>
                
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Gigsta AI is a platform where you can learn, grow, and collaborate with experienced professionals. 
                    As a student, you'll have access to exclusive content, mentorship opportunities, and a community 
                    of like-minded individuals.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteUrl}" 
                       style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; 
                              border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                        Accept Invitation & Sign Up
                    </a>
                </div>
                
                <p style="color: #999; font-size: 14px; line-height: 1.5;">
                    This invitation will expire in 7 days. If you don't want to join Gigsta AI, 
                    you can simply ignore this email.
                </p>
                
                <p style="color: #999; font-size: 14px; line-height: 1.5;">
                    If the button above doesn't work, you can copy and paste this link into your browser:
                    <br>
                    <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This email was sent from Gigsta AI. If you have any questions, please contact our support team.
                </p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

// Send invites to multiple students
const sendInvitesToStudents = async (request, response) => {
    const { emails } = request.body;
    const invitedBy = request.userID;

    try {
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            throw CustomException('Please provide at least one email address.', 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emails.filter(email => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
            throw CustomException(`Invalid email format: ${invalidEmails.join(', ')}`, 400);
        }

        // Get inviter details
        const inviter = await User.findById(invitedBy);
        if (!inviter) {
            throw CustomException('Inviter not found.', 404);
        }

        const results = [];
        const errors = [];

        for (const email of emails) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({ email: email.toLowerCase() });
                if (existingUser) {
                    errors.push({
                        email,
                        error: 'User already exists with this email'
                    });
                    continue;
                }

                // Check if invite already exists and is pending
                const existingInvite = await StudentInvite.findOne({ 
                    email: email.toLowerCase(),
                    status: 'pending'
                });
                if (existingInvite) {
                    errors.push({
                        email,
                        error: 'Invitation already sent to this email'
                    });
                    continue;
                }

                // Generate unique invite token
                const inviteToken = crypto.randomBytes(32).toString('hex');

                // Create invite record
                const invite = new StudentInvite({
                    email: email.toLowerCase(),
                    invitedBy,
                    inviteToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                });

                await invite.save();

                // Send email
                await sendStudentInviteEmail(email, inviter.username, inviteToken);

                results.push({
                    email,
                    status: 'invite_sent'
                });

            } catch (error) {
                errors.push({
                    email,
                    error: error.message
                });
            }
        }

        return response.status(200).send({
            error: false,
            message: `Invites processed. ${results.length} sent successfully.`,
            data: {
                successful: results,
                failed: errors
            }
        });

    } catch (error) {
        return response.status(error.status || 500).send({
            error: true,
            message: error.message
        });
    }
};

// Verify invite token
const verifyInviteToken = async (request, response) => {
    const { token } = request.params;

    try {
        const invite = await StudentInvite.findOne({ 
            inviteToken: token,
            status: 'pending'
        }).populate('invitedBy', 'username email');

        if (!invite) {
            throw CustomException('Invalid or expired invitation token.', 400);
        }

        if (new Date() > invite.expiresAt) {
            invite.status = 'expired';
            await invite.save();
            throw CustomException('Invitation has expired.', 400);
        }

        return response.status(200).send({
            error: false,
            message: 'Invitation token is valid.',
            data: {
                email: invite.email,
                invitedBy: invite.invitedBy.username
            }
        });

    } catch (error) {
        return response.status(error.status || 500).send({
            error: true,
            message: error.message
        });
    }
};

// Accept invite and create student account
const acceptInviteAndRegister = async (request, response) => {
    const { token, username, password, fullname, phone, image } = request.body;

    try {
        if (!token || !username || !password || !fullname) {
            throw CustomException('Missing required fields.', 400);
        }

        // Verify invite token
        const invite = await StudentInvite.findOne({ 
            inviteToken: token,
            status: 'pending'
        }).populate('invitedBy');

        if (!invite) {
            throw CustomException('Invalid or expired invitation token.', 400);
        }

        if (new Date() > invite.expiresAt) {
            invite.status = 'expired';
            await invite.save();
            throw CustomException('Invitation has expired.', 400);
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: invite.email },
                { username: username.toLowerCase() }
            ]
        });

        if (existingUser) {
            throw CustomException('User already exists with this email or username.', 400);
        }

        // Hash password
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        // Create student user
        const student = new User({
            username: username.toLowerCase(),
            email: invite.email,
            password: hash,
            fullname,
            phone,
            image,
            isSeller: false,
            sellerType: 'student',
            agencyId: invite.invitedBy._id,
            isVerified: true // Auto-verify students who come through invites
        });

        const savedStudent = await student.save();

        // Update invite status
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        invite.studentId = savedStudent._id;
        await invite.save();

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const authToken = jwt.sign({ userId: savedStudent._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Remove password from response
        const studentResponse = savedStudent.toObject();
        delete studentResponse.password;

        return response.status(201).send({
            error: false,
            message: 'Student account created successfully.',
            data: {
                user: studentResponse,
                token: authToken
            }
        });

    } catch (error) {
        return response.status(error.status || 500).send({
            error: true,
            message: error.message
        });
    }
};

// Get students by agency
const getStudentsByAgency = async (request, response) => {
    const agencyId = request.userID;

    try {
        const students = await User.find({ 
            agencyId,
            sellerType: 'student',
            deletedAt: null
        }).select('-password').sort({ createdAt: -1 });

        return response.status(200).send({
            error: false,
            message: 'Students retrieved successfully.',
            data: students
        });

    } catch (error) {
        return response.status(error.status || 500).send({
            error: true,
            message: error.message
        });
    }
};

module.exports = {
    sendInvitesToStudents,
    verifyInviteToken,
    acceptInviteAndRegister,
    getStudentsByAgency
};
