const express = require('express');
const { userMiddleware } = require('../middlewares');
const { 
    sendInvitesToStudents, 
    verifyInviteToken, 
    acceptInviteAndRegister,
    getStudentsByAgency, 
    getActiveStudentsByAgency,
    getPendingStudentsByAgency,
    deleteStudentByAgency
} = require('../controllers/studentInvite.controller');

const app = express.Router();

// Send invites to students (requires authentication)
app.post('/send-invites', userMiddleware, sendInvitesToStudents);

// Verify invite token (public endpoint)
app.get('/verify-invite/:token', verifyInviteToken);

// Accept invite and register student (public endpoint)
app.post('/accept-invite', acceptInviteAndRegister);

// Get students by agency (requires authentication)
app.get('/students', userMiddleware, getStudentsByAgency);

// Get ACTIVE students by agency (requires authentication)
app.get('/students/active', userMiddleware, getActiveStudentsByAgency);

// Get PENDING students by agency (requires authentication)
app.get('/students/pending', userMiddleware, getPendingStudentsByAgency);

// Delete student by id (soft delete, requires authentication)
app.delete('/students/:id', userMiddleware, deleteStudentByAgency);

module.exports = app;
