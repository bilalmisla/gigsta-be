const express = require('express');
const { userMiddleware } = require('../middlewares');
const { deleteUser, fetchTopSellers } = require('../controllers/user.controller');

const app = express.Router();

app.delete('/:_id', userMiddleware, deleteUser);

app.get('/top-sellers', fetchTopSellers);

module.exports = app;