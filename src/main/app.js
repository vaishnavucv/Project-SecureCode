const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');

const config = require('./config/AppConfig');
const Logger = require('./config/Logger');
const UploadController = require('./controllers/UploadController');
const AuthController = require('./controllers/AuthController');

/**
 * Secure File Upload Application
 * Implements OWASP best practices for secure web applications
 * Provides secure file upload, storage, and retrieval capabilities
 */
class SecureFileUploadApp {
  constructor() {
    this.app = express();
    this.logger = Logger;
    this.config = config;
    this.uploadController = new UploadController();
    this.authController = new AuthController();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup security middleware following OWASP guidelines
   */
  setupMiddleware() {
    // Security headers using Helmet
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    const corsOptions = {
      origin: this.config.get('cors.origin'),
      credentials: this.config.get('cors.credentials'),
      methods: this.config.get('cors.methods'),
      allowedHeaders: this.config.get('cors.allowed_headers'),
      optionsSuccessStatus: 200
    };
    this.app.use(cors(corsOptions));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Store raw body for signature verification if needed
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.getLogger().info('HTTP Request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });
      
      next();
    });

    // Rate limiting
    this.setupRateLimiting();

    // Session management
    this.setupSessionManagement();
  }

  /**
   * Setup rate limiting for different endpoints
   */
  setupRateLimiting() {
    // General API rate limiting
    const generalLimiter = rateLimit({
      windowMs: this.config.get('security.rate_limit.window_ms'),
      max: this.config.get('security.rate_limit.max_requests'),
      message: {
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(this.config.get('security.rate_limit.window_ms') / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.logRateLimit(
          req.userId || req.ip,
          'general_api',
          req.rateLimit.current
        );
        
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.get('security.rate_limit.window_ms') / 1000)
        });
      }
    });

    // Upload-specific rate limiting
    const uploadLimiter = rateLimit({
      windowMs: this.config.get('security.rate_limit.upload_window_ms'),
      max: this.config.get('security.rate_limit.max_uploads'),
      message: {
        success: false,
        error: 'Upload rate limit exceeded',
        retryAfter: Math.ceil(this.config.get('security.rate_limit.upload_window_ms') / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.logRateLimit(
          req.userId || req.ip,
          'file_upload',
          req.rateLimit.current
        );
        
        res.status(429).json({
          success: false,
          error: 'Upload rate limit exceeded',
          retryAfter: Math.ceil(this.config.get('security.rate_limit.upload_window_ms') / 1000)
        });
      }
    });

    // Apply rate limiting
    this.app.use('/api', generalLimiter);
    this.app.use('/api/upload', uploadLimiter);
  }

  /**
   * Setup session management
   */
  setupSessionManagement() {
    // In production, use Redis or database store
    this.app.use(session({
      secret: this.config.get('security.session_secret'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: this.config.isProduction(),
        httpOnly: true,
        maxAge: this.config.get('security.session_timeout_minutes') * 60 * 1000,
        sameSite: 'strict'
      },
      name: 'secureFileUpload.sid' // Don't use default session name
    }));
  }

  /**
   * Setup application routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: this.config.get('server.environment')
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Secure File Upload API',
        version: '1.0.0',
        endpoints: {
          upload: 'POST /api/upload',
          download: 'GET /api/files/:fileId',
          delete: 'DELETE /api/files/:fileId',
          list: 'GET /api/files',
          metadata: 'GET /api/files/:fileId/metadata',
          health: 'GET /api/health',
          stats: 'GET /api/stats'
        },
        documentation: '/api/docs'
      });
    });

    // Mount authentication controller
    this.app.use('/api/auth', this.authController.getRouter());

    // Mount upload controller
    this.app.use('/api', this.uploadController.getRouter());

    // Serve static files
    this.app.use('/static', express.static(path.join(__dirname, '../../public'), {
      maxAge: '1d',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // Security headers for static files
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }));

    // Serve dashboard at root
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      this.logger.getLogger().warn('404 Not Found', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
      });
    });
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.logError(error, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.userId
      });

      // Don't leak error details in production
      const isDevelopment = this.config.isDevelopment();
      
      res.status(500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.logError(error, { type: 'uncaught_exception' });
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.logError(new Error(reason), { 
        type: 'unhandled_rejection',
        promise: promise.toString()
      });
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  /**
   * Start the application server
   */
  async start() {
    try {
      const port = this.config.get('server.port');
      const host = this.config.get('server.host');

      // Ensure storage directory exists
      await this.uploadController.uploadService.fileStorageManager.ensureStorageDirectory();

      // Start server
      this.server = this.app.listen(port, host, () => {
        this.logger.getLogger().info('Server started', {
          port,
          host,
          environment: this.config.get('server.environment'),
          nodeVersion: process.version,
          platform: process.platform
        });

        console.log(`🚀 Secure File Upload Server running on http://${host}:${port}`);
        console.log(`📚 API Documentation: http://${host}:${port}/api`);
        console.log(`🏥 Health Check: http://${host}:${port}/health`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.logError(error, { action: 'server_start' });
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handling
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      this.logger.getLogger().info('Graceful shutdown initiated', { signal });

      this.server.close(() => {
        console.log('HTTP server closed.');
        
        // Close logger
        this.logger.close();
        
        console.log('Graceful shutdown completed.');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Get Express app instance
   * @returns {express.Application} Express application
   */
  getApp() {
    return this.app;
  }

  /**
   * Get server instance
   * @returns {http.Server} HTTP server
   */
  getServer() {
    return this.server;
  }
}

// Create and start application
const app = new SecureFileUploadApp();

// Start server if this file is run directly
if (require.main === module) {
  app.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = SecureFileUploadApp;
