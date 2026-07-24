/**
 * File Upload Validation Middleware
 * Validates file types and extensions for uploads
 */

// Approved file types for uploads
const ALLOWED_MIME_TYPES = {
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

// Approved file extensions
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];

// Unsafe file extensions to block
const BLOCKED_EXTENSIONS = ['exe', 'js', 'zip', 'bat', 'php', 'msi', 'dll', 'cmd', 'scr', 'vbs', 'ps1', 'jar', 'sh', 'app', 'dmg'];

// Unsafe MIME types to block
const BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-elf',
  'application/x-bat',
  'text/x-shellscript',
  'application/x-php',
  'application/x-jar',
  'application/x-zip-compressed',
  'application/zip',
];

/**
 * Validates a single file
 * @param {Object} file - The file object from multer
 * @returns {Object} { isValid: boolean, error?: string }
 */
const validateFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  const fileName = file.originalname.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

  // Check for blocked extensions
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: `File type .${extension} is not allowed for security reasons` };
  }

  // Check if extension is allowed
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: `Only PDF, DOC, DOCX, TXT, JPG, and PNG files are allowed` };
  }

  // Check for blocked MIME types
  if (BLOCKED_MIME_TYPES.includes(file.mimetype)) {
    return { isValid: false, error: 'File type is not allowed for security reasons' };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size exceeds 5MB limit' };
  }

  return { isValid: true };
};

/**
 * Middleware for validating uploaded files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const fileUploadValidatorMiddleware = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const errors = [];
  const validFiles = [];

  for (const file of req.files) {
    const validation = validateFile(file);
    if (validation.isValid) {
      validFiles.push(file);
    } else {
      errors.push(`${file.originalname}: ${validation.error}`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors,
      message: 'Some files failed validation',
    });
  }

  // Attach validated files to request for use by controllers
  req.validatedFiles = validFiles;
  next();
};

module.exports = {
  fileUploadValidatorMiddleware,
  validateFile,
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
};
