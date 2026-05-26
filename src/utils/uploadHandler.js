/**
 * File Upload Utility for Backend
 * Configures multer for secure file uploads
 */

const multer = require('multer');
const path = require('path');
const { fileUploadValidatorMiddleware } = require('../middlewares/fileUploadValidator');

// Configure storage
const storage = multer.memoryStorage(); // Store in memory or use diskStorage if needed

// File filter to check before multer processes
const fileFilter = (req, file, cb) => {
  // Initial check - reject obviously dangerous files at multer level
  const dangerousExtensions = ['exe', 'bat', 'cmd', 'msi', 'dll', 'sh', 'app', 'dmg'];
  const fileExt = path.extname(file.originalname).toLowerCase().slice(1);

  if (dangerousExtensions.includes(fileExt)) {
    cb(new Error(`File type .${fileExt} is not allowed`), false);
  } else {
    cb(null, true);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = {
  upload,
  fileUploadValidatorMiddleware,
};
