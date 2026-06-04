const express = require("express");
const { chatHandler, uploadInquiryFiles, finalizeInquiry } = require("../controllers/assistant.controller");

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/inquiry/upload", uploadInquiryFiles);
router.post("/inquiry/finalize", finalizeInquiry);

module.exports = router;
