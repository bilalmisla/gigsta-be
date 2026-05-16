const express = require("express");
const { chatHandler } = require("../controllers/assistant.controller");

const router = express.Router();

router.post("/chat", chatHandler);

module.exports = router;
