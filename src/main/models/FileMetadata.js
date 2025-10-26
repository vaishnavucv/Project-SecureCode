const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * FileMetadata Model
 * Represents file metadata for secure file upload system
 * Following OWASP guidelines for data handling and storage
 */
class FileMetadata {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId || null;
    this.originalFilename = data.originalFilename || '';
    this.storedFilename = data.storedFilename || '';
    this.filePath = data.filePath || '';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || '';
    this.fileExtension = data.fileExtension || '';
    this.uploadTimestamp = data.uploadTimestamp || new Date().toISOString();
    this.lastAccessed = data.lastAccessed || null;
    this.accessCount = data.accessCount || 0;
    this.status = data.status || 'active'; // active, deleted, quarantined
    this.checksum = data.checksum || '';
    this.virusScanStatus = data.virusScanStatus || 'pending'; // pending, clean, infected, error
    this.virusScanTimestamp = data.virusScanTimestamp || null;
    this.metadata = data.metadata || {}; // Additional metadata
  }

  /**
   * Create FileMetadata from upload data
   * @param {object} uploadData - Upload data object
   * @returns {FileMetadata} New FileMetadata instance
   */
  static fromUpload(uploadData) {
    const {
      userId,
      originalFilename,
      storedFilename,
      filePath,
      fileSize,
      mimeType,
      fileExtension,
      checksum
    } = uploadData;

    return new FileMetadata({
      userId,
      originalFilename: this.sanitizeFilename(originalFilename),
      storedFilename,
      filePath,
      fileSize: parseInt(fileSize, 10),
      mimeType,
      fileExtension: fileExtension.toLowerCase(),
      checksum
    });
  }

  /**
   * Sanitize filename to prevent path traversal and other security issues
   * Following OWASP input validation guidelines
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unknown_file';
    }

    // Remove path traversal attempts
    let sanitized = filename.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[\/\\]/g, '_');
    
    // Remove or replace dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    // Ensure filename is not empty
    if (!sanitized || sanitized.trim() === '') {
      sanitized = 'unknown_file';
    }

    return sanitized.trim();
  }

  /**
   * Validate file metadata for security and completeness
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Validate required fields
    if (!this.userId) {
      errors.push('User ID is required');
    }

    if (!this.originalFilename) {
      errors.push('Original filename is required');
    }

    if (!this.storedFilename) {
      errors.push('Stored filename is required');
    }

    if (!this.filePath) {
      errors.push('File path is required');
    }

    if (!this.fileSize || this.fileSize < 0) {
      errors.push('Valid file size is required');
    }

    if (!this.mimeType) {
      errors.push('MIME type is required');
    }

    // Validate file size (basic check)
    const maxSize = 100 * 1024 * 1024; // 100MB default max
    if (this.fileSize > maxSize) {
      errors.push('File size exceeds maximum allowed size');
    }

    // Validate MIME type format
    const mimeTypeRegex = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/;
    if (!mimeTypeRegex.test(this.mimeType)) {
      errors.push('Invalid MIME type format');
    }

    // Validate status
    const validStatuses = ['active', 'deleted', 'quarantined'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid file status');
    }

    // Validate virus scan status
    const validVirusStatuses = ['pending', 'clean', 'infected', 'error'];
    if (!validVirusStatuses.includes(this.virusScanStatus)) {
      errors.push('Invalid virus scan status');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update access information
   * @param {string} userId - User ID accessing the file
   */
  updateAccess(userId) {
    if (this.userId !== userId) {
      throw new Error('Unauthorized access attempt');
    }

    this.lastAccessed = new Date().toISOString();
    this.accessCount += 1;
  }

  /**
   * Mark file as deleted
   */
  markDeleted() {
    this.status = 'deleted';
  }

  /**
   * Mark file as quarantined
   * @param {string} reason - Reason for quarantine
   */
  markQuarantined(reason) {
    this.status = 'quarantined';
    this.metadata.quarantineReason = reason;
    this.metadata.quarantineTimestamp = new Date().toISOString();
  }

  /**
   * Update virus scan results
   * @param {string} status - Virus scan status
   * @param {string} details - Additional details
   */
  updateVirusScan(status, details = '') {
    this.virusScanStatus = status;
    this.virusScanTimestamp = new Date().toISOString();
    this.metadata.virusScanDetails = details;
  }

  /**
   * Convert to plain object for database storage
   * @returns {object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      originalFilename: this.originalFilename,
      storedFilename: this.storedFilename,
      filePath: this.filePath,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      fileExtension: this.fileExtension,
      uploadTimestamp: this.uploadTimestamp,
      lastAccessed: this.lastAccessed,
      accessCount: this.accessCount,
      status: this.status,
      checksum: this.checksum,
      virusScanStatus: this.virusScanStatus,
      virusScanTimestamp: this.virusScanTimestamp,
      metadata: JSON.stringify(this.metadata)
    };
  }

  /**
   * Create from database object
   * @param {object} dbObject - Database object
   * @returns {FileMetadata} FileMetadata instance
   */
  static fromDatabase(dbObject) {
    const metadata = new FileMetadata(dbObject);
    
    // Parse metadata JSON if it exists
    if (dbObject.metadata && typeof dbObject.metadata === 'string') {
      try {
        metadata.metadata = JSON.parse(dbObject.metadata);
      } catch (error) {
        console.warn('Failed to parse metadata JSON:', error.message);
        metadata.metadata = {};
      }
    }

    return metadata;
  }

  /**
   * Get safe filename for display (without path)
   * @returns {string} Safe filename for display
   */
  getDisplayFilename() {
    return this.originalFilename || this.storedFilename;
  }

  /**
   * Check if file is accessible
   * @returns {boolean} True if file is accessible
   */
  isAccessible() {
    return this.status === 'active' && this.virusScanStatus === 'clean';
  }

  /**
   * Get file size in human readable format
   * @returns {string} Human readable file size
   */
  getHumanReadableSize() {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (this.fileSize === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
    return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = FileMetadata;
