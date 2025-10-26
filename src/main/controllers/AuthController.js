const express = require('express');
const { body, validationResult } = require('express-validator');
const UserService = require('../services/UserService');
const Logger = require('../config/Logger');

/**
 * AuthController - Authentication API Controller
 * Handles user registration, login, and authentication
 * Following OWASP best practices for authentication
 */
class AuthController {
  constructor() {
    this.userService = new UserService();
    this.logger = Logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Setup authentication routes
   */
  setupRoutes() {
    // User registration
    this.router.post('/register',
      [
        body('firstName').notEmpty().trim().isLength({ min: 1, max: 50 }),
        body('lastName').notEmpty().trim().isLength({ min: 1, max: 50 }),
        body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }).matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      ],
      this.validateRegistrationRequest,
      this.handleRegistration.bind(this)
    );

    // User login
    this.router.post('/login',
      [
        body('usernameOrEmail').notEmpty().trim(),
        body('password').notEmpty()
      ],
      this.validateLoginRequest,
      this.handleLogin.bind(this)
    );

    // Check username availability
    this.router.get('/check-username/:username',
      this.handleCheckUsername.bind(this)
    );

    // Check email availability
    this.router.get('/check-email/:email',
      this.handleCheckEmail.bind(this)
    );

    // Get current user info
    this.router.get('/me',
      this.authenticateUser.bind(this),
      this.handleGetCurrentUser.bind(this)
    );

    // Admin routes
    this.router.get('/admin/users',
      this.authenticateUser.bind(this),
      this.handleGetAllUsers.bind(this)
    );

    this.router.post('/admin/users/:userId/approve',
      this.authenticateUser.bind(this),
      this.handleApproveUser.bind(this)
    );

    this.router.post('/admin/users/:userId/reject',
      this.authenticateUser.bind(this),
      this.handleRejectUser.bind(this)
    );

    this.router.post('/admin/users/:userId/suspend',
      this.authenticateUser.bind(this),
      this.handleSuspendUser.bind(this)
    );

    this.router.get('/admin/stats',
      this.authenticateUser.bind(this),
      this.handleGetUserStats.bind(this)
    );
  }

  /**
   * Validate registration request
   */
  validateRegistrationRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.logValidationFailure('registration_request_validation', {
        errors: errors.array(),
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid registration data',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  }

  /**
   * Validate login request
   */
  validateLoginRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      this.logger.logValidationFailure('login_request_validation', {
        errors: errors.array(),
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid login data',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  }

  /**
   * Middleware for user authentication
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
   * Handle user registration
   */
  async handleRegistration(req, res) {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      const ip = req.ip;

      this.logger.logAuthEvent('registration_attempt', {
        username,
        email,
        ip
      });

      const result = await this.userService.registerUser({
        username,
        email,
        password,
        firstName,
        lastName,
        ip
      });

      if (result.success) {
        this.logger.logAuthEvent('registration_success', {
          userId: result.userId,
          username: result.username,
          ip
        }, true);

        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            userId: result.userId,
            username: result.username,
            status: result.status
          }
        });
      } else {
        this.logger.logAuthEvent('registration_failed', {
          username,
          email,
          error: result.error,
          ip
        }, false);

        const statusCode = result.code === 'USERNAME_EXISTS' || result.code === 'EMAIL_EXISTS' ? 409 : 400;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'registration',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }

  /**
   * Handle user login
   */
  async handleLogin(req, res) {
    try {
      const { usernameOrEmail, password } = req.body;
      const ip = req.ip;

      this.logger.logAuthEvent('login_attempt', {
        username: usernameOrEmail,
        ip
      });

      const result = await this.userService.authenticateUser(usernameOrEmail, password, ip);

      if (result.success) {
        // Generate simple token (in production, use JWT)
        const token = `${result.user.id}:${Date.now()}`;

        this.logger.logAuthEvent('login_success', {
          userId: result.user.id,
          username: result.user.username,
          ip
        }, true);

        res.json({
          success: true,
          message: result.message,
          data: {
            user: result.user,
            token
          }
        });
      } else {
        this.logger.logAuthEvent('login_failed', {
          username: usernameOrEmail,
          error: result.error,
          ip
        }, false);

        const statusCode = result.code === 'ACCOUNT_LOCKED' ? 423 : 
                          result.code === 'ACCOUNT_INACTIVE' ? 403 : 401;

        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'login',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }

  /**
   * Handle check username availability
   */
  async handleCheckUsername(req, res) {
    try {
      const { username } = req.params;

      if (!User.isValidUsername(username)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid username format',
          code: 'INVALID_USERNAME'
        });
      }

      const result = this.userService.isUsernameAvailable(username);
      res.json(result);

    } catch (error) {
      this.logger.logError(error, {
        action: 'check_username',
        username: req.params.username
      });

      res.status(500).json({
        success: false,
        error: 'Failed to check username',
        code: 'CHECK_ERROR'
      });
    }
  }

  /**
   * Handle check email availability
   */
  async handleCheckEmail(req, res) {
    try {
      const { email } = req.params;

      if (!User.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }

      const result = this.userService.isEmailAvailable(email);
      res.json(result);

    } catch (error) {
      this.logger.logError(error, {
        action: 'check_email',
        email: req.params.email
      });

      res.status(500).json({
        success: false,
        error: 'Failed to check email',
        code: 'CHECK_ERROR'
      });
    }
  }

  /**
   * Handle get current user
   */
  async handleGetCurrentUser(req, res) {
    try {
      res.json({
        success: true,
        data: req.user
      });

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_current_user',
        userId: req.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get user information',
        code: 'USER_INFO_ERROR'
      });
    }
  }

  /**
   * Handle get all users (admin only)
   */
  async handleGetAllUsers(req, res) {
    try {
      const { status, role, limit, offset } = req.query;
      
      const result = this.userService.getAllUsers(req.userId, {
        status,
        role,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined
      });

      if (result.success) {
        res.json({
          success: true,
          data: result.users,
          pagination: result.pagination
        });
      } else {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : 500;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_all_users',
        userId: req.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve users',
        code: 'RETRIEVAL_ERROR'
      });
    }
  }

  /**
   * Handle approve user (admin only)
   */
  async handleApproveUser(req, res) {
    try {
      const { userId } = req.params;
      
      const result = await this.userService.approveUser(userId, req.userId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: result.user
        });
      } else {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : 
                          result.code === 'USER_NOT_FOUND' ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'approve_user',
        userId: req.params.userId,
        adminUserId: req.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to approve user',
        code: 'APPROVAL_ERROR'
      });
    }
  }

  /**
   * Handle reject user (admin only)
   */
  async handleRejectUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      
      const result = await this.userService.rejectUser(userId, req.userId, reason);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: result.user
        });
      } else {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : 
                          result.code === 'USER_NOT_FOUND' ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'reject_user',
        userId: req.params.userId,
        adminUserId: req.userId,
        reason: req.body.reason
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reject user',
        code: 'REJECTION_ERROR'
      });
    }
  }

  /**
   * Handle suspend user (admin only)
   */
  async handleSuspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      
      const result = await this.userService.suspendUser(userId, req.userId, reason);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: result.user
        });
      } else {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : 
                          result.code === 'USER_NOT_FOUND' ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'suspend_user',
        userId: req.params.userId,
        adminUserId: req.userId,
        reason: req.body.reason
      });

      res.status(500).json({
        success: false,
        error: 'Failed to suspend user',
        code: 'SUSPENSION_ERROR'
      });
    }
  }

  /**
   * Handle get user statistics (admin only)
   */
  async handleGetUserStats(req, res) {
    try {
      const result = this.userService.getUserStats(req.userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.stats
        });
      } else {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : 500;
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_user_stats',
        userId: req.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user statistics',
        code: 'STATS_ERROR'
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

module.exports = AuthController;
