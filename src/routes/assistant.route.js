const express = require("express");
const { chatHandler, uploadInquiryFiles } = require("../controllers/assistant.controller");

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/inquiry/upload", uploadInquiryFiles);

module.exports = router;
