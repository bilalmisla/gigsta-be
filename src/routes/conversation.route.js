const express = require('express');
const { userMiddleware } = require('../middlewares');
const { getConversations, createConversation, getSingleConversation, updateConversation } = require('../controllers/conversation.controller');
// const { Message } = require('../models');
// const { Conversation } = require('../models');

const app = express.Router();

// Get all
app.get('/', userMiddleware, getConversations);

// Create
app.post('/', userMiddleware, createConversation);

// Get single
app.get('/single/:sellerID/:buyerID', userMiddleware, getSingleConversation);

// Update
app.patch('/:conversationID', userMiddleware, updateConversation);

// Update all conversation
// app.get('/update-all', async (req, res) => {
//     try {
//         const result = await Message.updateMany(
//             {},
//             {
//                 $set: {
//                     deletedBySeller: false,
//                     deletedByBuyer: false
//                 }
//             }
//         );

//         res.status(200).json({
//             message: 'All message records updated',
//             modifiedCount: result.modifiedCount
//         });
//     } catch (error) {
//         res.status(500).json({ message: 'Error updating conversations', error });
//     }
// });

module.exports = app;