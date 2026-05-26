/**
 * File Validation Controller
 * Handles file validation and upload checks
 */

const { validateFile } = require('../middlewares/fileUploadValidator');

/**
 * Validate files before upload
 * POST /file/validate
 */
const validateFilesController = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided',
      });
    }

    const results = [];
    const allValid = true;

    for (const file of req.files) {
      const validation = validateFile(file);
      results.push({
        filename: file.originalname,
        size: file.size,
        ...validation,
      });
    }

    const hasErrors = results.some((r) => !r.isValid);

    return res.status(hasErrors ? 400 : 200).json({
      success: !hasErrors,
      results: results,
      message: hasErrors
        ? 'Some files failed validation'
        : 'All files passed validation',
    });
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({
      success: false,
      error: 'File validation failed',
      message: error.message,
    });
  }
};

module.exports = {
  validateFilesController,
};
