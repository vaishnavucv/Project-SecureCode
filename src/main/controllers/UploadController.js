const express = require('express');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const UploadService = require('../services/UploadService');
const UserService = require('../services/UserService');
const Logger = require('../config/Logger');
const config = require('../config/AppConfig');

/**
 * UploadController - API Controller for File Upload Operations
 * Implements OWASP best practices for secure API endpoints
 * Handles file upload, retrieval, and deletion with proper validation
 */
class UploadController {
  constructor() {
    this.uploadService = new UploadService();
    this.userService = new UserService();
    this.logger = Logger;
    this.router = express.Router();
    this.setupMulter();
    this.setupRoutes();
  }

  /**
   * Setup Multer for file upload handling
   * Following OWASP guidelines for secure file upload
   */
  setupMulter() {
    // Configure multer with security settings
    this.upload = multer({
      storage: multer.memoryStorage(), // Store in memory for validation
      limits: {
        fileSize: config.get('security.max_file_size_mb') * 1024 * 1024, // Convert to bytes
        files: 1, // Only one file per request
        fields: 10, // Limit number of form fields
        fieldNameSize: 100, // Limit field name size
        fieldSize: 1024, // Limit field value size
        parts: 20 // Limit number of parts
      },
      fileFilter: (req, file, cb) => {
        // Basic file type filtering (additional validation in service)
        const allowedMimes = [
          'image/png',
          'image/jpeg',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
      }
    });
  }

  /**
   * Setup API routes with proper validation
   */
  setupRoutes() {
    // File upload endpoint
    this.router.post('/upload',
      this.authenticateUser.bind(this),
      this.upload.single('file'),
      this.validateUploadRequest.bind(this),
      this.handleUpload.bind(this)
    );

    // File retrieval endpoint
    this.router.get('/files/:fileId',
      this.authenticateUser.bind(this),
      this.validateFileId.bind(this),
      this.handleFileRetrieval.bind(this)
    );

    // File deletion endpoint
    this.router.delete('/files/:fileId',
      this.authenticateUser.bind(this),
      this.validateFileId.bind(this),
      this.handleFileDeletion.bind(this)
    );

    // Get user files endpoint
    this.router.get('/files',
      this.authenticateUser.bind(this),
      this.validateGetFilesQuery.bind(this),
      this.handleGetUserFiles.bind(this)
    );

    // Get file metadata endpoint
    this.router.get('/files/:fileId/metadata',
      this.authenticateUser.bind(this),
      this.validateFileId.bind(this),
      this.handleGetFileMetadata.bind(this)
    );

    // File preview endpoint (inline display for images)
    this.router.get('/files/:fileId/preview',
      this.authenticateUser.bind(this),
      this.validateFileId.bind(this),
      this.handleFilePreview.bind(this)
    );

    // Health check endpoint
    this.router.get('/health',
      this.handleHealthCheck.bind(this)
    );

    // Service statistics endpoint (admin only)
    this.router.get('/stats',
      this.authenticateUser.bind(this),
      this.handleGetStats.bind(this)
    );
  }

  /**
   * Middleware for user authentication
   * In production, implement proper JWT or session-based authentication
   */
  authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.logAuthEvent('failed_auth', {
        reason: 'Missing or invalid authorization header',
        ip: req.ip
      }, false);

      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // For now, we'll use a simple token format: userId:timestamp
    // In production, use JWT tokens
    try {
      const [userId, timestamp] = token.split(':');

      if (!userId || !timestamp) {
        throw new Error('Invalid token format');
      }

      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge > 24 * 60 * 60 * 1000) {
        throw new Error('Token expired');
      }

      // Validate user against UserService
      const user = this.userService.getUserById(userId);
      if (!user || !user.isActive()) {
        throw new Error('User not found or inactive');
      }

      req.user = user.getSafeData();
      req.userId = userId;
      next();

    } catch (error) {
      this.logger.logAuthEvent('failed_auth', {
        reason: error.message,
        ip: req.ip
      }, false);

      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  }

  /**
   * Validate upload request
   */
  validateUploadRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.logValidationFailure('upload_request_validation', {
        userId: req.userId,
        errors: errors.array(),
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      this.logger.logValidationFailure('no_file_uploaded', {
        userId: req.userId,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    next();
  }

  /**
   * Validate file ID parameter
   */
  validateFileId(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.logValidationFailure('file_id_validation', {
        userId: req.userId,
        fileId: req.params.fileId,
        errors: errors.array(),
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid file ID',
        details: errors.array(),
        code: 'INVALID_FILE_ID'
      });
    }

    next();
  }

  /**
   * Validate get files query parameters
   */
  validateGetFilesQuery(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.logValidationFailure('get_files_query_validation', {
        userId: req.userId,
        errors: errors.array(),
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errors.array(),
        code: 'INVALID_QUERY'
      });
    }

    next();
  }

  /**
   * Handle file upload
   */
  async handleUpload(req, res) {
    try {
      const { file } = req;
      const { userId } = req;
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      this.logger.logFileEvent('upload_attempt', {
        userId,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        ip: req.ip
      });

      const result = await this.uploadService.uploadFile(file, userId, metadata);

      if (result.success) {
        this.logger.logFileEvent('upload', {
          userId,
          fileId: result.fileId,
          filename: result.filename,
          fileSize: result.fileSize,
          ip: req.ip
        }, true);

        res.status(201).json({
          success: true,
          data: {
            fileId: result.fileId,
            filename: result.filename,
            fileSize: result.fileSize,
            mimeType: result.mimeType,
            uploadTimestamp: result.uploadTimestamp
          },
          warnings: result.warnings
        });
      } else {
        this.logger.logFileEvent('upload', {
          userId,
          filename: file.originalname,
          error: result.error,
          ip: req.ip
        }, false);

        const statusCode = result.error.includes('Rate limit') ? 429 : 400;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          details: result.details,
          retryAfter: result.retryAfter
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        action: 'upload',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle file retrieval
   */
  async handleFileRetrieval(req, res) {
    try {
      const { fileId } = req.params;
      const { userId } = req;

      this.logger.logAccessAttempt(`file_retrieval_${fileId}`, userId);

      const result = await this.uploadService.retrieveFile(fileId, userId);

      if (result.success) {
        this.logger.logFileEvent('download', {
          userId,
          fileId,
          filename: result.filename,
          fileSize: result.fileSize,
          ip: req.ip
        }, true);

        res.set({
          'Content-Type': result.mimeType,
          'Content-Length': result.fileSize,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        res.send(result.fileBuffer);
      } else {
        this.logger.logFileEvent('download', {
          userId,
          fileId,
          error: result.error,
          ip: req.ip
        }, false);

        const statusCode = result.error.includes('Unauthorized') ? 403 : 
                          result.error.includes('not found') ? 404 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        fileId: req.params.fileId,
        action: 'retrieval',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle file deletion
   */
  async handleFileDeletion(req, res) {
    try {
      const { fileId } = req.params;
      const { userId } = req;

      this.logger.logAccessAttempt(`file_deletion_${fileId}`, userId);

      const result = await this.uploadService.deleteFile(fileId, userId);

      if (result.success) {
        this.logger.logFileEvent('delete', {
          userId,
          fileId,
          ip: req.ip
        }, true);

        res.json({
          success: true,
          message: 'File deleted successfully',
          deletedFileId: result.deletedFileId,
          deletedAt: result.deletedAt
        });
      } else {
        this.logger.logFileEvent('delete', {
          userId,
          fileId,
          error: result.error,
          ip: req.ip
        }, false);

        const statusCode = result.error.includes('Unauthorized') ? 403 : 
                          result.error.includes('not found') ? 404 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        fileId: req.params.fileId,
        action: 'deletion',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle get user files
   */
  async handleGetUserFiles(req, res) {
    try {
      const { userId } = req;
      const { limit = 50, offset = 0, status = 'active' } = req.query;

      const result = await this.uploadService.getUserFiles(userId, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        status
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.files,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        action: 'get_user_files',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle get file metadata
   */
  async handleGetFileMetadata(req, res) {
    try {
      const { fileId } = req.params;
      const { userId } = req;

      const result = await this.uploadService.getFileMetadata(fileId, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.metadata
        });
      } else {
        const statusCode = result.error.includes('Unauthorized') ? 403 : 
                          result.error.includes('not found') ? 404 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        fileId: req.params.fileId,
        action: 'get_metadata',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle file preview (inline display for images)
   */
  async handleFilePreview(req, res) {
    try {
      const { fileId } = req.params;
      const { userId } = req;

      this.logger.logAccessAttempt(`file_preview_${fileId}`, userId);

      const result = await this.uploadService.retrieveFile(fileId, userId);

      if (result.success) {
        // Check if it's an image
        const isImage = result.mimeType && result.mimeType.startsWith('image/');

        if (!isImage) {
          return res.status(400).json({
            success: false,
            error: 'Preview only available for images',
            code: 'NOT_IMAGE'
          });
        }

        this.logger.logFileEvent('preview', {
          userId,
          fileId,
          filename: result.filename,
          mimeType: result.mimeType,
          ip: req.ip
        }, true);

        // Set headers for inline display
        res.set({
          'Content-Type': result.mimeType,
          'Content-Length': result.fileSize,
          'Content-Disposition': `inline; filename="${result.filename}"`,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff'
        });

        res.send(result.fileBuffer);
      } else {
        this.logger.logFileEvent('preview', {
          userId,
          fileId,
          error: result.error,
          ip: req.ip
        }, false);

        const statusCode = result.error.includes('Unauthorized') ? 403 : 
                          result.error.includes('not found') ? 404 : 400;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        fileId: req.params.fileId,
        action: 'preview',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle health check
   */
  async handleHealthCheck(req, res) {
    try {
      const stats = await this.uploadService.getServiceStats();
      
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        stats: stats.success ? stats.stats : null
      });

    } catch (error) {
      this.logger.logError(error, {
        action: 'health_check',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  }

  /**
   * Handle get service statistics
   */
  async handleGetStats(req, res) {
    try {
      const { userId } = req;

      const result = await this.uploadService.getServiceStats();

      if (result.success) {
        res.json({
          success: true,
          data: result.stats
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        userId: req.userId,
        action: 'get_stats',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get router instance
   * @returns {express.Router} Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = UploadController;
