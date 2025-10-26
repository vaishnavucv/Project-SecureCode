const path = require('path');
const fs = require('fs');
// Use a simple file type detection instead of file-type package
// const { fileTypeFromBuffer } = require('file-type');
const mimeTypes = require('mime-types');
const sanitizeFilename = require('sanitize-filename');
const crypto = require('crypto');
const config = require('../config/AppConfig');

/**
 * Simple file type detection function
 * @param {Buffer} buffer - File buffer
 * @returns {object|null} Detected file type or null
 */
function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  const header = buffer.slice(0, 4);
  
  // PNG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  
  // JPEG
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  
  // GIF
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  
  // PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }
  
  // ZIP (for DOCX, XLSX)
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return { ext: 'zip', mime: 'application/zip' };
  }
  
  return null;
}

/**
 * FileValidator - Secure File Validation Module
 * Implements OWASP best practices for file upload security
 * Validates file extensions, MIME types, content, and prevents path traversal
 */
class FileValidator {
  constructor() {
    this.config = config.getSecurityConfig();
    this.allowedExtensions = this.config.allowed_extensions.map(ext => ext.toLowerCase());
    this.maxFileSize = this.config.max_file_size_mb * 1024 * 1024; // Convert to bytes
  }

  /**
   * Comprehensive file validation following OWASP guidelines
   * @param {object} file - Multer file object
   * @param {string} userId - User ID for logging
   * @returns {object} Validation result with isValid, errors, and sanitized data
   */
  async validateFile(file, userId) {
    const validationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      sanitizedData: null
    };

    try {
      // 1. Basic file existence and structure validation
      const basicValidation = this.validateBasicFileStructure(file);
      if (!basicValidation.isValid) {
        validationResult.errors.push(...basicValidation.errors);
        return validationResult;
      }

      // 2. File size validation
      const sizeValidation = this.validateFileSize(file);
      if (!sizeValidation.isValid) {
        validationResult.errors.push(...sizeValidation.errors);
        return validationResult;
      }

      // 3. Filename validation and sanitization
      const filenameValidation = this.validateAndSanitizeFilename(file.originalname);
      if (!filenameValidation.isValid) {
        validationResult.errors.push(...filenameValidation.errors);
        return validationResult;
      }

      // 4. File extension validation
      const extensionValidation = this.validateFileExtension(file.originalname);
      if (!extensionValidation.isValid) {
        validationResult.errors.push(...extensionValidation.errors);
        return validationResult;
      }

      // 5. MIME type validation
      const mimeValidation = await this.validateMimeType(file);
      if (!mimeValidation.isValid) {
        validationResult.errors.push(...mimeValidation.errors);
        return validationResult;
      }

      // 6. File content validation (magic number check)
      const contentValidation = await this.validateFileContent(file);
      if (!contentValidation.isValid) {
        validationResult.errors.push(...contentValidation.errors);
        return validationResult;
      }

      // 7. Security checks
      const securityValidation = await this.performSecurityChecks(file);
      if (!securityValidation.isValid) {
        validationResult.errors.push(...securityValidation.errors);
        return validationResult;
      }

      // If all validations pass, create sanitized data
      validationResult.isValid = true;
      validationResult.sanitizedData = {
        originalFilename: filenameValidation.sanitizedFilename,
        fileExtension: path.extname(filenameValidation.sanitizedFilename).toLowerCase(),
        mimeType: mimeValidation.detectedMimeType,
        fileSize: file.size,
        checksum: await this.calculateChecksum(file.buffer),
        validationTimestamp: new Date().toISOString()
      };

      // Add any warnings
      validationResult.warnings.push(...(mimeValidation.warnings || []));
      validationResult.warnings.push(...(contentValidation.warnings || []));

    } catch (error) {
      validationResult.errors.push(`Validation error: ${error.message}`);
    }

    return validationResult;
  }

  /**
   * Validate basic file structure
   * @param {object} file - Multer file object
   * @returns {object} Validation result
   */
  validateBasicFileStructure(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    if (!file.originalname || typeof file.originalname !== 'string') {
      errors.push('Invalid filename');
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      errors.push('Invalid file data');
    }

    if (!file.size || file.size <= 0) {
      errors.push('Invalid file size');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file size against configured limits
   * @param {object} file - Multer file object
   * @returns {object} Validation result
   */
  validateFileSize(file) {
    const errors = [];

    if (file.size > this.maxFileSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.config.max_file_size_mb}MB)`);
    }

    // Additional check for empty files
    if (file.size === 0) {
      errors.push('Empty files are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and sanitize filename to prevent path traversal
   * @param {string} filename - Original filename
   * @returns {object} Validation result with sanitized filename
   */
  validateAndSanitizeFilename(filename) {
    const errors = [];

    if (!filename || typeof filename !== 'string') {
      errors.push('Invalid filename');
      return { isValid: false, errors };
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename contains path traversal characters');
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f\x7f]/;
    if (dangerousChars.test(filename)) {
      errors.push('Filename contains dangerous characters');
    }

    // Check filename length
    if (filename.length > 255) {
      errors.push('Filename too long (maximum 255 characters)');
    }

    // Sanitize filename
    let sanitizedFilename = sanitizeFilename(filename);
    
    // Additional sanitization for extra security
    sanitizedFilename = sanitizedFilename.replace(/\.\./g, '');
    sanitizedFilename = sanitizedFilename.replace(/[\/\\]/g, '_');
    sanitizedFilename = sanitizedFilename.replace(/[<>:"|?*\x00-\x1f\x7f]/g, '_');

    // Ensure filename is not empty after sanitization
    if (!sanitizedFilename || sanitizedFilename.trim() === '') {
      errors.push('Filename becomes empty after sanitization');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedFilename: sanitizedFilename.trim()
    };
  }

  /**
   * Validate file extension against allowed list
   * @param {string} filename - Filename to check
   * @returns {object} Validation result
   */
  validateFileExtension(filename) {
    const errors = [];
    const fileExtension = path.extname(filename).toLowerCase();

    if (!fileExtension) {
      errors.push('File must have an extension');
      return { isValid: false, errors };
    }

    if (!this.allowedExtensions.includes(fileExtension)) {
      errors.push(`File extension '${fileExtension}' is not allowed. Allowed extensions: ${this.allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate MIME type using multiple methods
   * @param {object} file - Multer file object
   * @returns {object} Validation result with detected MIME type
   */
  async validateMimeType(file) {
    const errors = [];
    const warnings = [];
    let detectedMimeType = null;

    try {
      // Method 1: Use file-type library (magic number detection)
      const fileTypeResult = detectFileType(file.buffer);
      if (fileTypeResult) {
        detectedMimeType = fileTypeResult.mime;
      }

      // Method 2: Use mime-types library based on extension
      const extensionMimeType = mimeTypes.lookup(file.originalname);

      // Method 3: Check if multer detected MIME type
      const multerMimeType = file.mimetype;

      // Validate consistency between different MIME type detection methods
      const detectedMimeTypes = [detectedMimeType, extensionMimeType, multerMimeType].filter(Boolean);
      const uniqueMimeTypes = [...new Set(detectedMimeTypes)];

      if (uniqueMimeTypes.length > 1) {
        warnings.push(`MIME type inconsistency detected: ${uniqueMimeTypes.join(', ')}`);
      }

      // Use the most reliable MIME type (file-type library result)
      const finalMimeType = detectedMimeType || extensionMimeType || multerMimeType;

      if (!finalMimeType) {
        errors.push('Unable to determine MIME type');
        return { isValid: false, errors, warnings };
      }

      // Validate MIME type against allowed extensions
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const expectedMimeTypes = this.getExpectedMimeTypes(fileExtension);

      if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(finalMimeType)) {
        errors.push(`MIME type '${finalMimeType}' does not match expected type for extension '${fileExtension}'`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        detectedMimeType: finalMimeType
      };

    } catch (error) {
      errors.push(`MIME type validation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate file content using magic number detection
   * @param {object} file - Multer file object
   * @returns {object} Validation result
   */
  async validateFileContent(file) {
    const errors = [];
    const warnings = [];

    try {
      // Check file signature (magic number)
      const fileTypeResult = detectFileType(file.buffer);
      
      if (!fileTypeResult) {
        warnings.push('Unable to detect file type from content');
      } else {
        // Verify that the detected type matches the extension
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const expectedExtensions = this.getExpectedExtensions(fileTypeResult.mime);
        
        if (!expectedExtensions.includes(fileExtension)) {
          errors.push(`File content does not match extension. Detected: ${fileTypeResult.mime}, Expected extension for this type: ${expectedExtensions.join(', ')}`);
        }
      }

      // Additional content validation for specific file types
      const contentValidation = await this.validateSpecificFileContent(file, fileTypeResult);
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`Content validation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Perform additional security checks
   * @param {object} file - Multer file object
   * @returns {object} Validation result
   */
  async performSecurityChecks(file) {
    const errors = [];

    try {
      // Check for embedded executable content
      const executableSignatures = [
        Buffer.from([0x4D, 0x5A]), // MZ (PE executable)
        Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
        Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
      ];

      for (const signature of executableSignatures) {
        if (file.buffer.indexOf(signature) === 0) {
          errors.push('File appears to be an executable, which is not allowed');
          break;
        }
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /eval\(/i,
        /document\.cookie/i
      ];

      const fileContent = file.buffer.toString('utf8', 0, Math.min(1024, file.buffer.length));
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fileContent)) {
          errors.push('File contains suspicious content patterns');
          break;
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Security check error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Validate specific file content based on file type
   * @param {object} file - Multer file object
   * @param {object} fileTypeResult - File type detection result
   * @returns {object} Validation result
   */
  async validateSpecificFileContent(file, fileTypeResult) {
    const errors = [];

    if (!fileTypeResult) {
      return { isValid: true, errors };
    }

    try {
      switch (fileTypeResult.mime) {
        case 'image/jpeg':
        case 'image/png':
        case 'image/gif':
          // Additional image validation could be added here
          break;
        
        case 'application/pdf':
          // Check PDF structure
          if (!file.buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
            errors.push('Invalid PDF file structure');
          }
          break;
        
        case 'text/plain':
          // Check for binary content in text files
          const textContent = file.buffer.toString('utf8');
          if (textContent.includes('\0')) {
            errors.push('Text file contains null bytes, may be binary');
          }
          break;
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Specific content validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Calculate file checksum for integrity verification
   * @param {Buffer} buffer - File buffer
   * @returns {string} SHA-256 checksum
   */
  async calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get expected MIME types for a file extension
   * @param {string} extension - File extension
   * @returns {Array} Array of expected MIME types
   */
  getExpectedMimeTypes(extension) {
    const mimeTypeMap = {
      '.png': ['image/png'],
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.gif': ['image/gif'],
      '.pdf': ['application/pdf'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.txt': ['text/plain'],
      '.csv': ['text/csv'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    };

    return mimeTypeMap[extension] || [];
  }

  /**
   * Get expected extensions for a MIME type
   * @param {string} mimeType - MIME type
   * @returns {Array} Array of expected extensions
   */
  getExpectedExtensions(mimeType) {
    const extensionMap = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    };

    return extensionMap[mimeType] || [];
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if file extension is allowed
   * @param {string} extension - File extension to check
   * @returns {boolean} True if extension is allowed
   */
  isExtensionAllowed(extension) {
    return this.allowedExtensions.includes(extension.toLowerCase());
  }

  /**
   * Get list of allowed extensions
   * @returns {Array} Array of allowed extensions
   */
  getAllowedExtensions() {
    return [...this.allowedExtensions];
  }

  /**
   * Get maximum file size in bytes
   * @returns {number} Maximum file size in bytes
   */
  getMaxFileSize() {
    return this.maxFileSize;
  }
}

module.exports = FileValidator;
