const express = require("express");
const { chatHandler, finalizeInquiry } = require("../controllers/assistant.controller");
const { upload } = require("../utils/uploadHandler");
const { extractMultipleFiles } = require("../utils/fileExtractor");

const router = express.Router();

router.post("/chat", chatHandler);
router.post("/inquiry/upload", upload.array('files', 10), async (req, res, next) => {
	try {
		const { inquiryId } = req.body;

		if (!inquiryId) {
			return res.status(400).json({ success: false, message: "inquiryId is required" });
		}

		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ success: false, message: "No files provided" });
		}

		// Extract content from all files using OpenAI
		const extractedContents = await extractMultipleFiles(req.files);

		// Find and update the inquiry
		const Inquiry = require("../models/inquiry.model");
		const inquiry = await Inquiry.findById(inquiryId);

		if (!inquiry) {
			return res.status(404).json({ success: false, message: "Inquiry not found" });
		}

		// Store extracted content
		inquiry.extractedContent = [...(inquiry.extractedContent || []), ...extractedContents];
		await inquiry.save();

		return res.status(200).json({
			success: true,
			message: "Files processed and content extracted successfully",
			extractedContent: extractedContents,
			inquiry,
		});
	} catch (error) {
		console.error("Error in file extraction endpoint:", error);
		res.status(500).json({ success: false, message: "Failed to extract file content: " + error.message });
	}
});
router.post("/inquiry/finalize", finalizeInquiry);

module.exports = router;
