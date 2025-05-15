const express = require('express');
const { userMiddleware } = require('../middlewares');
const { createMessage, getMessages, deleteMessage, deleteConversation } = require('../controllers/message.controller');
const app = express.Router();

// Create
app.post('/', userMiddleware, createMessage);

// Get all of one conversation
app.get('/:conversationID', userMiddleware, getMessages);

// Delete a single message
app.delete('/message/:messageID', userMiddleware, deleteMessage);

// Delete a conversation and all its messages
app.delete('/conversation/:conversationID', userMiddleware, deleteConversation);

module.exports = app;

