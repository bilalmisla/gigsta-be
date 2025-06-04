const express = require('express');
const { 
    authLogin, authLogout, authRegister, authStatus, 
    verifyEmail, authResetPassword, authConfirmPassword, 
    authUpdatePassword, 
    authUpdateProfile,
    authUpdateEmail,
    authDeleteAccount,
    signInWithFacebook,
    handleFetchProfile
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares');
const { User } = require('../models');

const app = express.Router();

// Register
app.post('/register', authRegister);

// Login
app.post('/login', authLogin);

// Logout
app.post('/logout', authLogout)

// Check Auth status
app.get('/me', authenticate, authStatus);

// Route for email verification
app.get('/verify-email', verifyEmail);

// Route for reset password
app.post('/reset-password', authResetPassword);

// Route for confirm password
app.post('/confirm-password', authConfirmPassword);

// Route for update password
app.post('/update-password', authenticate, authUpdatePassword);

// Route for update profile
app.post('/update-profile', authenticate, authUpdateProfile);

// Route for update profile
app.get('/update-email', authUpdateEmail);

// Route for update profile
app.delete('/delete-account', authenticate, authDeleteAccount);

// Handle Facebook OAuth Callback
app.post("/facebook", signInWithFacebook);

// Route to fetch profile
app.get('/fetch-profile/:username', handleFetchProfile);

// Middleware to verify token
const authenticateToken = async (req, res, next) => {
    const token = req.headers['Authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.id, 'tokens.token': token });

        if (!user) return res.status(401).json({ error: 'Invalid token' });

        req.user = user;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Route to check token and return user
app.get('/validate', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = app;