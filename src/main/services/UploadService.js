const fs = require('fs').promises;
const path = require('path');
const FileValidator = require('../validation/FileValidator');
const FileStorageManager = require('../storage/FileStorageManager');
const FileMetadata = require('../models/FileMetadata');
const config = require('../config/AppConfig');

/**
 * UploadService - Business Logic Layer for File Upload Operations
 * Implements OWASP best practices for secure file upload handling
 * Coordinates validation, storage, and metadata management
 */
class UploadService {
  constructor() {
    this.fileValidator = new FileValidator();
    this.fileStorageManager = new FileStorageManager();
    this.uploadHistory = new Map(); // In-memory storage for demo (use database in production)
    this.rateLimiter = new Map(); // Simple rate limiting (use Redis in production)
    this.persistenceFile = path.join(process.cwd(), 'data', 'upload_history.json');
    this.loadUploadHistory();
  }

  /**
   * Load upload history from persistent storage
   */
  async loadUploadHistory() {
    try {
      console.log(`Attempting to load upload history from: ${this.persistenceFile}`);
      await fs.access(this.persistenceFile);
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const historyData = JSON.parse(data);

      // Convert back to Map with FileMetadata instances
      this.uploadHistory = new Map();
      for (const [key, value] of Object.entries(historyData)) {
        // Reconstruct FileMetadata instance from plain object
        const fileMetadata = FileMetadata.fromDatabase(value);
        this.uploadHistory.set(key, fileMetadata);
      }

      console.log(`Loaded ${this.uploadHistory.size} files from persistent storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, create directory
        const dataDir = path.dirname(this.persistenceFile);
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`Created data directory: ${dataDir}`);
        console.log('No existing upload history found - starting fresh');
      } else {
        console.error('Error loading upload history:', error.message);
      }
    }
  }

  /**
   * Save upload history to persistent storage
   */
  async saveUploadHistory() {
    try {
      const dataDir = path.dirname(this.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Convert Map to object for JSON serialization
      const historyData = Object.fromEntries(this.uploadHistory);
      await fs.writeFile(this.persistenceFile, JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.error('Error saving upload history:', error.message);
    }
  }

  /**
   * Process file upload with comprehensive security validation
   * @param {object} file - Multer file object
   * @param {string} userId - User ID
   * @param {object} metadata - Additional metadata
   * @returns {object} Upload result
   */
  async uploadFile(file, userId, metadata = {}) {
    const uploadId = this.generateUploadId();
    const startTime = Date.now();

    try {
      // 1. Rate limiting check
      const rateLimitResult = this.checkRateLimit(userId);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        };
      }

      // 2. Comprehensive file validation
      const validationResult = await this.fileValidator.validateFile(file, userId);
      if (!validationResult.isValid) {
        await this.logSecurityEvent('validation_failed', {
          userId,
          filename: file.originalname,
          errors: validationResult.errors,
          uploadId
        });

        return {
          success: false,
          error: 'File validation failed',
          details: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // 3. Store file securely
      const storageResult = await this.fileStorageManager.storeFile(
        file.buffer,
        validationResult.sanitizedData.originalFilename,
        validationResult.sanitizedData.mimeType,
        userId
      );

      if (!storageResult.success) {
        await this.logSecurityEvent('storage_failed', {
          userId,
          filename: file.originalname,
          error: storageResult.error,
          uploadId
        });

        return {
          success: false,
          error: 'File storage failed',
          details: storageResult.error
        };
      }

      // 4. Create file metadata
      const fileMetadata = FileMetadata.fromUpload({
        userId,
        originalFilename: validationResult.sanitizedData.originalFilename,
        storedFilename: storageResult.storedFilename,
        filePath: storageResult.filePath,
        fileSize: storageResult.fileSize,
        mimeType: storageResult.mimeType,
        fileExtension: validationResult.sanitizedData.fileExtension,
        checksum: storageResult.checksum
      });

      // Mark as clean immediately (no actual virus scanner configured)
      // In production, integrate with actual AV scanner
      fileMetadata.virusScanStatus = 'clean';
      fileMetadata.virusScanTimestamp = new Date().toISOString();

      // Add additional metadata
      fileMetadata.metadata = {
        ...fileMetadata.metadata,
        ...metadata,
        uploadId,
        processingTime: Date.now() - startTime,
        validationWarnings: validationResult.warnings
      };

      // 5. Store metadata (in production, use database)
      this.uploadHistory.set(fileMetadata.id, fileMetadata);

      // 6. Update rate limiting
      this.updateRateLimit(userId);

      // 7. Save to persistent storage
      await this.saveUploadHistory();

      // 8. Log successful upload
      await this.logSecurityEvent('upload_success', {
        userId,
        fileId: fileMetadata.id,
        filename: fileMetadata.originalFilename,
        fileSize: fileMetadata.fileSize,
        uploadId,
        processingTime: Date.now() - startTime
      });

      return {
        success: true,
        fileId: fileMetadata.id,
        filename: fileMetadata.originalFilename,
        fileSize: fileMetadata.fileSize,
        mimeType: fileMetadata.mimeType,
        uploadTimestamp: fileMetadata.uploadTimestamp,
        warnings: validationResult.warnings
      };

    } catch (error) {
      await this.logSecurityEvent('upload_error', {
        userId,
        filename: file.originalname,
        error: error.message,
        uploadId
      });

      return {
        success: false,
        error: 'Upload processing failed',
        details: error.message
      };
    }
  }

  /**
   * Retrieve file for download
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {object} File retrieval result
   */
  async retrieveFile(fileId, userId) {
    try {
      // 1. Get file metadata
      const fileMetadata = this.uploadHistory.get(fileId);
      if (!fileMetadata) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // 2. Check authorization
      if (fileMetadata.userId !== userId) {
        await this.logSecurityEvent('unauthorized_access_attempt', {
          userId,
          fileId,
          ownerId: fileMetadata.userId
        });

        return {
          success: false,
          error: 'Unauthorized access'
        };
      }

      // 3. Check file status
      if (!fileMetadata.isAccessible()) {
        return {
          success: false,
          error: 'File is not accessible',
          details: `Status: ${fileMetadata.status}, Virus scan: ${fileMetadata.virusScanStatus}`
        };
      }

      // 4. Retrieve file from storage
      const storageResult = await this.fileStorageManager.retrieveFile(
        fileMetadata.storedFilename,
        userId
      );

      if (!storageResult.success) {
        return {
          success: false,
          error: 'File retrieval failed',
          details: storageResult.error
        };
      }

      // 5. Update access information
      fileMetadata.updateAccess(userId);

      // 6. Log access
      await this.logSecurityEvent('file_accessed', {
        userId,
        fileId,
        filename: fileMetadata.originalFilename,
        accessCount: fileMetadata.accessCount
      });

      return {
        success: true,
        fileBuffer: storageResult.fileBuffer,
        filename: fileMetadata.originalFilename,
        mimeType: storageResult.mimeType,
        fileSize: storageResult.fileSize,
        lastModified: storageResult.lastModified
      };

    } catch (error) {
      await this.logSecurityEvent('retrieval_error', {
        userId,
        fileId,
        error: error.message
      });

      return {
        success: false,
        error: 'File retrieval failed',
        details: error.message
      };
    }
  }

  /**
   * Delete file
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {object} Deletion result
   */
  async deleteFile(fileId, userId) {
    try {
      // 1. Get file metadata
      const fileMetadata = this.uploadHistory.get(fileId);
      if (!fileMetadata) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // 2. Check authorization
      if (fileMetadata.userId !== userId) {
        await this.logSecurityEvent('unauthorized_deletion_attempt', {
          userId,
          fileId,
          ownerId: fileMetadata.userId
        });

        return {
          success: false,
          error: 'Unauthorized access'
        };
      }

      // 3. Delete file from storage
      const storageResult = await this.fileStorageManager.deleteFile(
        fileMetadata.storedFilename,
        userId
      );

      if (!storageResult.success) {
        return {
          success: false,
          error: 'File deletion failed',
          details: storageResult.error
        };
      }

      // 4. Mark metadata as deleted
      fileMetadata.markDeleted();

      // 5. Save to persistent storage
      await this.saveUploadHistory();

      // 6. Log deletion
      await this.logSecurityEvent('file_deleted', {
        userId,
        fileId,
        filename: fileMetadata.originalFilename,
        fileSize: fileMetadata.fileSize
      });

      return {
        success: true,
        deletedFileId: fileId,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      await this.logSecurityEvent('deletion_error', {
        userId,
        fileId,
        error: error.message
      });

      return {
        success: false,
        error: 'File deletion failed',
        details: error.message
      };
    }
  }

  /**
   * Get user's uploaded files
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {object} Files list result
   */
  async getUserFiles(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, status = 'active' } = options;

      console.log(`Getting files for user: ${userId}, status: ${status}, limit: ${limit}, offset: ${offset}`);
      console.log(`Total files in uploadHistory: ${this.uploadHistory.size}`);

      // Filter files by user and status
      const userFiles = Array.from(this.uploadHistory.values())
        .filter(file => file.userId === userId && file.status === status)
        .sort((a, b) => new Date(b.uploadTimestamp) - new Date(a.uploadTimestamp))
        .slice(offset, offset + limit);

      console.log(`Found ${userFiles.length} files for user ${userId}`);

      // Return safe file information (no sensitive data)
      const safeFiles = userFiles.map(file => ({
        id: file.id,
        originalFilename: file.originalFilename,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        uploadTimestamp: file.uploadTimestamp,
        lastAccessed: file.lastAccessed,
        accessCount: file.accessCount,
        status: file.status,
        virusScanStatus: file.virusScanStatus
      }));

      return {
        success: true,
        files: safeFiles,
        total: userFiles.length,
        limit,
        offset
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve user files',
        details: error.message
      };
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {object} File metadata result
   */
  async getFileMetadata(fileId, userId) {
    try {
      const fileMetadata = this.uploadHistory.get(fileId);
      if (!fileMetadata) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Check authorization
      if (fileMetadata.userId !== userId) {
        return {
          success: false,
          error: 'Unauthorized access'
        };
      }

      return {
        success: true,
        metadata: {
          id: fileMetadata.id,
          originalFilename: fileMetadata.originalFilename,
          fileSize: fileMetadata.fileSize,
          mimeType: fileMetadata.mimeType,
          uploadTimestamp: fileMetadata.uploadTimestamp,
          lastAccessed: fileMetadata.lastAccessed,
          accessCount: fileMetadata.accessCount,
          status: fileMetadata.status,
          virusScanStatus: fileMetadata.virusScanStatus,
          checksum: fileMetadata.checksum
        }
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve file metadata',
        details: error.message
      };
    }
  }

  /**
   * Check rate limiting for user
   * @param {string} userId - User ID
   * @returns {object} Rate limit check result
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const windowMs = config.get('security.rate_limit.window_ms');
    const maxRequests = config.get('security.rate_limit.max_requests');

    if (!this.rateLimiter.has(userId)) {
      this.rateLimiter.set(userId, { count: 0, resetTime: now + windowMs });
    }

    const userLimit = this.rateLimiter.get(userId);

    // Reset if window has passed
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }

    if (userLimit.count >= maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      };
    }

    return { allowed: true };
  }

  /**
   * Update rate limiting for user
   * @param {string} userId - User ID
   */
  updateRateLimit(userId) {
    if (this.rateLimiter.has(userId)) {
      this.rateLimiter.get(userId).count++;
    }
  }

  /**
   * Generate unique upload ID for tracking
   * @returns {string} Upload ID
   */
  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log security events
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  async logSecurityEvent(event, data) {
    // In production, use proper logging service
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data: {
        ...data,
        // Remove sensitive information
        filename: data.filename ? this.sanitizeForLogging(data.filename) : undefined
      }
    };

    console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   * @param {string} data - Data to sanitize
   * @returns {string} Sanitized data
   */
  sanitizeForLogging(data) {
    if (typeof data !== 'string') {
      return data;
    }

    // Remove path information
    return data.replace(/.*[\/\\]/, '').substring(0, 50);
  }

  /**
   * Get service statistics
   * @returns {object} Service statistics
   */
  async getServiceStats() {
    try {
      const totalFiles = this.uploadHistory.size;
      const activeFiles = Array.from(this.uploadHistory.values())
        .filter(file => file.status === 'active').length;

      const storageStats = await this.fileStorageManager.getStorageStats();

      return {
        success: true,
        stats: {
          totalFiles,
          activeFiles,
          deletedFiles: totalFiles - activeFiles,
          storage: storageStats.success ? storageStats : null
        }
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve service statistics',
        details: error.message
      };
    }
  }

  /**
   * Clean up old files (maintenance)
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {object} Cleanup result
   */
  async cleanupOldFiles(maxAgeDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      let cleanedCount = 0;
      const errors = [];

      for (const [fileId, fileMetadata] of this.uploadHistory.entries()) {
        try {
          const uploadDate = new Date(fileMetadata.uploadTimestamp);
          if (uploadDate < cutoffDate && fileMetadata.status === 'active') {
            // Delete file from storage
            const storageResult = await this.fileStorageManager.deleteFile(
              fileMetadata.storedFilename,
              fileMetadata.userId
            );

            if (storageResult.success) {
              fileMetadata.markDeleted();
              cleanedCount++;
            } else {
              errors.push(`Failed to delete file ${fileId}: ${storageResult.error}`);
            }
          }
        } catch (error) {
          errors.push(`Failed to process file ${fileId}: ${error.message}`);
        }
      }

      return {
        success: true,
        cleanedCount,
        errors
      };

    } catch (error) {
      return {
        success: false,
        error: 'Cleanup failed',
        details: error.message
      };
    }
  }
}

module.exports = UploadService;
