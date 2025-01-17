const express = require('express');
const { authLogin, authLogout, authRegister, authStatus, verifyEmail } = require('../controllers/auth.controller');
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