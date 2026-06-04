/**
 * File Upload Validation Routes
 */

const express = require('express');
const { upload, fileUploadValidatorMiddleware } = require('../utils/uploadHandler');
const { validateFilesController } = require('../controllers/file.controller');

const router = express.Router();

/**
 * POST /file/validate
 * Validate files before upload
 */
router.post('/validate', upload.array('files', 10), fileUploadValidatorMiddleware, validateFilesController);

module.exports = router;
