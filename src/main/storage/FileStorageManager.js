const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/AppConfig');

/**
 * FileStorageManager - Secure File Storage Module
 * Implements OWASP best practices for secure file storage
 * Handles file storage, retrieval, and deletion with proper security controls
 */
class FileStorageManager {
  constructor() {
    this.config = config.getSecurityConfig();
    this.storagePath = path.resolve(this.config.storage_path);
    this.storagePermissions = parseInt(this.config.storage_permissions, 8);
    this.ensureStorageDirectory();
  }

  /**
   * Ensure storage directory exists with proper permissions
   * Following OWASP guidelines for secure file storage
   */
  async ensureStorageDirectory() {
    try {
      // Check if storage directory exists
      await fs.access(this.storagePath);
      
      // Verify directory permissions
      const stats = await fs.stat(this.storagePath);
      if (!stats.isDirectory()) {
        throw new Error('Storage path exists but is not a directory');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create directory if it doesn't exist
        await fs.mkdir(this.storagePath, { recursive: true, mode: 0o755 });
        console.log(`Created storage directory: ${this.storagePath}`);
      } else {
        throw new Error(`Storage directory error: ${error.message}`);
      }
    }
  }

  /**
   * Store file securely with proper isolation and permissions
   * @param {Buffer} fileBuffer - File content buffer
   * @param {string} originalFilename - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} userId - User ID
   * @returns {object} Storage result with file information
   */
  async storeFile(fileBuffer, originalFilename, mimeType, userId) {
    try {
      // Generate secure filename to prevent path traversal
      const secureFilename = this.generateSecureFilename(originalFilename);
      const filePath = path.join(this.storagePath, secureFilename);

      // Ensure file doesn't already exist (collision handling)
      const finalFilePath = await this.handleFilenameCollision(filePath);

      // Write file with secure permissions
      await fs.writeFile(finalFilePath, fileBuffer, { mode: this.storagePermissions });

      // Verify file was written correctly
      await this.verifyFileIntegrity(finalFilePath, fileBuffer);

      // Calculate file metadata
      const fileStats = await fs.stat(finalFilePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        success: true,
        storedFilename: path.basename(finalFilePath),
        filePath: finalFilePath,
        fileSize: fileStats.size,
        checksum,
        mimeType,
        uploadTimestamp: new Date().toISOString(),
        permissions: this.storagePermissions
      };

    } catch (error) {
      console.error('File storage error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate secure filename to prevent path traversal and conflicts
   * @param {string} originalFilename - Original filename
   * @returns {string} Secure filename
   */
  generateSecureFilename(originalFilename) {
    // Extract file extension
    const fileExtension = path.extname(originalFilename).toLowerCase();
    
    // Generate UUID for uniqueness
    const uuid = uuidv4();
    
    // Create secure filename: UUID + extension
    const secureFilename = `${uuid}${fileExtension}`;
    
    // Additional security: ensure no path traversal
    const sanitizedFilename = path.basename(secureFilename);
    
    return sanitizedFilename;
  }

  /**
   * Handle filename collisions by appending counter
   * @param {string} filePath - Original file path
   * @returns {string} Final file path (may be modified if collision occurred)
   */
  async handleFilenameCollision(filePath) {
    let counter = 0;
    let finalFilePath = filePath;

    while (true) {
      try {
        await fs.access(finalFilePath);
        // File exists, try with counter
        counter++;
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        finalFilePath = path.join(dir, `${base}_${counter}${ext}`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, we can use this path
          break;
        } else {
          throw error;
        }
      }
    }

    return finalFilePath;
  }

  /**
   * Verify file integrity after writing
   * @param {string} filePath - Path to written file
   * @param {Buffer} originalBuffer - Original file buffer
   * @returns {boolean} True if integrity check passes
   */
  async verifyFileIntegrity(filePath, originalBuffer) {
    try {
      const writtenBuffer = await fs.readFile(filePath);
      
      if (writtenBuffer.length !== originalBuffer.length) {
        throw new Error('File size mismatch after writing');
      }

      const originalChecksum = crypto.createHash('sha256').update(originalBuffer).digest('hex');
      const writtenChecksum = crypto.createHash('sha256').update(writtenBuffer).digest('hex');

      if (originalChecksum !== writtenChecksum) {
        throw new Error('File checksum mismatch after writing');
      }

      return true;
    } catch (error) {
      // Clean up corrupted file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Failed to clean up corrupted file:', unlinkError);
      }
      throw error;
    }
  }

  /**
   * Retrieve file for download
   * @param {string} storedFilename - Stored filename
   * @param {string} userId - User ID (for authorization)
   * @returns {object} File retrieval result
   */
  async retrieveFile(storedFilename, userId) {
    try {
      // Validate filename to prevent path traversal
      if (!this.isValidStoredFilename(storedFilename)) {
        throw new Error('Invalid filename');
      }

      const filePath = path.join(this.storagePath, storedFilename);

      // Check if file exists
      await fs.access(filePath);

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const fileStats = await fs.stat(filePath);

      // Verify file is not executable (security check)
      const isExecutable = await this.isFileExecutable(filePath);
      if (isExecutable) {
        throw new Error('File appears to be executable, access denied');
      }

      return {
        success: true,
        fileBuffer,
        fileSize: fileStats.size,
        mimeType: this.getMimeTypeFromFilename(storedFilename),
        lastModified: fileStats.mtime
      };

    } catch (error) {
      console.error('File retrieval error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file from storage
   * @param {string} storedFilename - Stored filename
   * @param {string} userId - User ID (for authorization)
   * @returns {object} Deletion result
   */
  async deleteFile(storedFilename, userId) {
    try {
      // Validate filename to prevent path traversal
      if (!this.isValidStoredFilename(storedFilename)) {
        throw new Error('Invalid filename');
      }

      const filePath = path.join(this.storagePath, storedFilename);

      // Check if file exists
      await fs.access(filePath);

      // Delete file
      await fs.unlink(filePath);

      return {
        success: true,
        deletedFilename: storedFilename,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('File deletion error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file exists in storage
   * @param {string} storedFilename - Stored filename
   * @returns {boolean} True if file exists
   */
  async fileExists(storedFilename) {
    try {
      if (!this.isValidStoredFilename(storedFilename)) {
        return false;
      }

      const filePath = path.join(this.storagePath, storedFilename);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file information without reading content
   * @param {string} storedFilename - Stored filename
   * @returns {object} File information
   */
  async getFileInfo(storedFilename) {
    try {
      if (!this.isValidStoredFilename(storedFilename)) {
        throw new Error('Invalid filename');
      }

      const filePath = path.join(this.storagePath, storedFilename);
      const stats = await fs.stat(filePath);

      return {
        success: true,
        fileSize: stats.size,
        mimeType: this.getMimeTypeFromFilename(storedFilename),
        created: stats.birthtime,
        modified: stats.mtime,
        isExecutable: await this.isFileExecutable(filePath)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate stored filename to prevent path traversal
   * @param {string} filename - Filename to validate
   * @returns {boolean} True if filename is valid
   */
  isValidStoredFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return false;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f\x7f]/;
    if (dangerousChars.test(filename)) {
      return false;
    }

    // Check filename length
    if (filename.length > 255) {
      return false;
    }

    // Ensure filename is not empty
    if (filename.trim() === '') {
      return false;
    }

    return true;
  }

  /**
   * Check if file is executable (security check)
   * @param {string} filePath - Path to file
   * @returns {boolean} True if file appears to be executable
   */
  async isFileExecutable(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file permissions
      const mode = stats.mode;
      const isExecutable = !!(mode & parseInt('111', 8)); // Check if any execute bit is set
      
      if (isExecutable) {
        return true;
      }

      // Check file content for executable signatures
      const buffer = await fs.readFile(filePath, { start: 0, end: 4 });
      const executableSignatures = [
        Buffer.from([0x4D, 0x5A]), // MZ (PE executable)
        Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
        Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
      ];

      for (const signature of executableSignatures) {
        if (buffer.equals(signature)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking file executability:', error);
      return true; // Assume executable if we can't determine
    }
  }

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string} MIME type
   */
  getMimeTypeFromFilename(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Clean up old files (for maintenance)
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {object} Cleanup result
   */
  async cleanupOldFiles(maxAgeDays = 30) {
    try {
      const files = await fs.readdir(this.storagePath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      let cleanedCount = 0;
      const errors = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.storagePath, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          errors.push(`Failed to clean up ${file}: ${error.message}`);
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
        error: error.message
      };
    }
  }

  /**
   * Get storage statistics
   * @returns {object} Storage statistics
   */
  async getStorageStats() {
    try {
      const files = await fs.readdir(this.storagePath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.storagePath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (error) {
          // Skip files we can't stat
          continue;
        }
      }

      return {
        success: true,
        fileCount,
        totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize),
        storagePath: this.storagePath
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
}

module.exports = FileStorageManager;
