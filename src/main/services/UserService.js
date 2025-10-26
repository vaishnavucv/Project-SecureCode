const User = require('../models/User');
const Logger = require('../config/Logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * UserService - User Management Service
 * Handles user registration, authentication, and management
 * Following OWASP best practices for user management
 * Singleton pattern to ensure single instance across all controllers
 */
class UserService {
  constructor() {
    // Singleton pattern: return existing instance if it exists
    if (UserService.instance) {
      return UserService.instance;
    }

    this.users = new Map(); // In-memory storage for demo (use database in production)
    this.logger = Logger;
    this.persistenceFile = path.join(process.cwd(), 'data', 'users.json');

    // Store the instance
    UserService.instance = this;

    // Load users asynchronously, then initialize admin if needed
    this.loadUsers()
      .then(() => this.initializeDefaultAdmin())
      .catch(error => {
        console.error('Failed to load users:', error);
      });
  }

  /**
   * Load users from persistent storage
   */
  async loadUsers() {
    try {
      console.log(`Attempting to load users from: ${this.persistenceFile}`);
      await fs.access(this.persistenceFile);
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const usersData = JSON.parse(data);

      // Convert back to Map with User instances
      this.users = new Map();
      for (const [key, value] of Object.entries(usersData)) {
        // Reconstruct User instance from plain object
        const user = new User(value);
        this.users.set(key, user);
      }

      console.log(`Loaded ${this.users.size} users from persistent storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, create directory
        const dataDir = path.dirname(this.persistenceFile);
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`Created data directory: ${dataDir}`);
        console.log('No existing users found - starting fresh');
      } else {
        console.error('Error loading users:', error.message);
      }
    }
  }

  /**
   * Save users to persistent storage
   */
  async saveUsers() {
    try {
      const dataDir = path.dirname(this.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Convert Map to object for JSON serialization
      const usersData = {};
      for (const [key, user] of this.users.entries()) {
        usersData[key] = user.toObject(); // Use toObject method for proper serialization
      }
      
      await fs.writeFile(this.persistenceFile, JSON.stringify(usersData, null, 2));
      console.log(`Saved ${this.users.size} users to persistent storage`);
    } catch (error) {
      console.error('Error saving users:', error.message);
    }
  }

  /**
   * Initialize default admin user
   */
  async initializeDefaultAdmin() {
    try {
      const adminExists = Array.from(this.users.values()).some(user => user.isAdmin());
      
      if (!adminExists) {
        const adminUser = await User.fromRegistration({
          username: 'admin',
          email: 'admin@securefileupload.com',
          password: 'Admin123!',
          firstName: 'System',
          lastName: 'Administrator'
        });
        
        adminUser.role = 'admin';
        adminUser.status = 'active';
        adminUser.emailVerified = true;

        this.users.set(adminUser.id, adminUser);
        await this.saveUsers(); // Save to persistence

        this.logger.getLogger().info('Default admin user created', {
          username: adminUser.username,
          email: adminUser.email
        });

        console.log('🔐 Default admin user created:');
        console.log('   Username: admin');
        console.log('   Password: Admin123!');
        console.log('   Email: admin@securefileupload.com');
      }
    } catch (error) {
      this.logger.logError(error, { action: 'initialize_default_admin' });
    }
  }

  /**
   * Register a new user
   * @param {object} registrationData - User registration data
   * @returns {object} Registration result
   */
  async registerUser(registrationData) {
    try {
      // Check if username already exists
      const existingUserByUsername = Array.from(this.users.values())
        .find(user => user.username === registrationData.username.toLowerCase());
      
      if (existingUserByUsername) {
        return {
          success: false,
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        };
      }

      // Check if email already exists
      const existingUserByEmail = Array.from(this.users.values())
        .find(user => user.email === registrationData.email.toLowerCase());
      
      if (existingUserByEmail) {
        return {
          success: false,
          error: 'Email already exists',
          code: 'EMAIL_EXISTS'
        };
      }

      // Create new user
      const user = await User.fromRegistration(registrationData);
      this.users.set(user.id, user);

      // Save to persistent storage
      await this.saveUsers();

      // Log registration
      this.logger.logAuthEvent('user_registered', {
        userId: user.id,
        username: user.username,
        email: user.email,
        ip: registrationData.ip || 'unknown'
      });

      return {
        success: true,
        message: 'Registration successful. Your account is pending admin approval.',
        userId: user.id,
        username: user.username,
        status: user.status
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'user_registration',
        username: registrationData.username,
        email: registrationData.email
      });

      return {
        success: false,
        error: error.message,
        code: 'REGISTRATION_ERROR'
      };
    }
  }

  /**
   * Authenticate user login
   * @param {string} usernameOrEmail - Username or email
   * @param {string} password - Password
   * @param {string} ip - Client IP address
   * @returns {object} Authentication result
   */
  async authenticateUser(usernameOrEmail, password, ip = 'unknown') {
    try {
      // Validate input
      const validation = User.validateLoginCredentials(usernameOrEmail, password);
      if (!validation.isValid) {
        this.logger.logAuthEvent('failed_login', {
          username: usernameOrEmail,
          reason: 'Invalid credentials format',
          ip
        }, false);

        return {
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        };
      }

      // Find user by username or email
      const user = Array.from(this.users.values())
        .find(u => u.username === usernameOrEmail.toLowerCase() || u.email === usernameOrEmail.toLowerCase());

      if (!user) {
        this.logger.logAuthEvent('failed_login', {
          username: usernameOrEmail,
          reason: 'User not found',
          ip
        }, false);

        return {
          success: false,
          error: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS'
        };
      }

      // Check if account is locked
      if (user.isLocked()) {
        this.logger.logAuthEvent('failed_login', {
          userId: user.id,
          username: user.username,
          reason: 'Account locked',
          ip
        }, false);

        return {
          success: false,
          error: 'Account is locked due to too many failed login attempts',
          code: 'ACCOUNT_LOCKED'
        };
      }

      // Check if account is active
      if (!user.isActive()) {
        this.logger.logAuthEvent('failed_login', {
          userId: user.id,
          username: user.username,
          reason: `Account status: ${user.status}`,
          ip
        }, false);

        return {
          success: false,
          error: `Account is ${user.status}. Please contact administrator.`,
          code: 'ACCOUNT_INACTIVE'
        };
      }

      // Verify password
      const isPasswordValid = await user.verifyPassword(password);

      if (!isPasswordValid) {
        user.incrementLoginAttempts();
        this.users.set(user.id, user);
        await this.saveUsers(); // Save after failed login attempt

        this.logger.logAuthEvent('failed_login', {
          userId: user.id,
          username: user.username,
          reason: 'Invalid password',
          attempts: user.loginAttempts,
          ip
        }, false);

        return {
          success: false,
          error: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS'
        };
      }

      // Successful login
      user.resetLoginAttempts();
      this.users.set(user.id, user);
      await this.saveUsers(); // Save after successful login

      this.logger.logAuthEvent('successful_login', {
        userId: user.id,
        username: user.username,
        ip
      }, true);

      return {
        success: true,
        user: user.getSafeData(),
        message: 'Login successful'
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'user_authentication',
        username: usernameOrEmail,
        ip
      });

      return {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      };
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {object} User data or null
   */
  getUserById(userId) {
    const user = this.users.get(userId);
    return user || null;
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {object} User data or null
   */
  getUserByUsername(username) {
    const user = Array.from(this.users.values())
      .find(u => u.username === username.toLowerCase());
    return user ? user.getSafeData() : null;
  }

  /**
   * Get all users (admin only)
   * @param {string} adminUserId - Admin user ID
   * @param {object} options - Query options
   * @returns {object} Users list result
   */
  getAllUsers(adminUserId, options = {}) {
    try {
      const adminUser = this.users.get(adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          error: 'Unauthorized access',
          code: 'UNAUTHORIZED'
        };
      }

      const { status, role, limit = 50, offset = 0 } = options;
      let users = Array.from(this.users.values());

      console.log(`Getting users for admin: ${adminUserId}, status filter: ${status}, role filter: ${role}`);
      console.log(`Total users in system: ${users.length}`);

      // Filter by status
      if (status) {
        users = users.filter(user => user.status === status);
        console.log(`Users after status filter (${status}): ${users.length}`);
      }

      // Filter by role
      if (role) {
        users = users.filter(user => user.role === role);
        console.log(`Users after role filter (${role}): ${users.length}`);
      }

      // Sort by creation date (newest first)
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Pagination
      const total = users.length;
      users = users.slice(offset, offset + limit);

      // Return safe user data
      const safeUsers = users.map(user => user.getSafeData());

      return {
        success: true,
        users: safeUsers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_all_users',
        adminUserId
      });

      return {
        success: false,
        error: 'Failed to retrieve users',
        code: 'RETRIEVAL_ERROR'
      };
    }
  }

  /**
   * Approve user account (admin only)
   * @param {string} userId - User ID to approve
   * @param {string} adminUserId - Admin user ID
   * @returns {object} Approval result
   */
  async approveUser(userId, adminUserId) {
    try {
      const adminUser = this.users.get(adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          error: 'Unauthorized access',
          code: 'UNAUTHORIZED'
        };
      }

      const user = this.users.get(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      if (user.status !== 'pending') {
        return {
          success: false,
          error: 'User is not pending approval',
          code: 'INVALID_STATUS'
        };
      }

      user.approve(adminUserId);
      this.users.set(userId, user);

      // Save to persistent storage
      await this.saveUsers();

      this.logger.logAuthEvent('user_approved', {
        userId: user.id,
        username: user.username,
        adminUserId: adminUserId,
        adminUsername: adminUser.username
      }, true);

      return {
        success: true,
        message: 'User approved successfully',
        user: user.getSafeData()
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'approve_user',
        userId,
        adminUserId
      });

      return {
        success: false,
        error: 'Failed to approve user',
        code: 'APPROVAL_ERROR'
      };
    }
  }

  /**
   * Reject user account (admin only)
   * @param {string} userId - User ID to reject
   * @param {string} adminUserId - Admin user ID
   * @param {string} reason - Rejection reason
   * @returns {object} Rejection result
   */
  async rejectUser(userId, adminUserId, reason) {
    try {
      const adminUser = this.users.get(adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          error: 'Unauthorized access',
          code: 'UNAUTHORIZED'
        };
      }

      const user = this.users.get(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      if (user.status !== 'pending') {
        return {
          success: false,
          error: 'User is not pending approval',
          code: 'INVALID_STATUS'
        };
      }

      user.reject(adminUserId, reason);
      this.users.set(userId, user);

      // Save to persistent storage
      await this.saveUsers();

      this.logger.logAuthEvent('user_rejected', {
        userId: user.id,
        username: user.username,
        adminUserId: adminUserId,
        adminUsername: adminUser.username,
        reason
      }, true);

      return {
        success: true,
        message: 'User rejected successfully',
        user: user.getSafeData()
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'reject_user',
        userId,
        adminUserId,
        reason
      });

      return {
        success: false,
        error: 'Failed to reject user',
        code: 'REJECTION_ERROR'
      };
    }
  }

  /**
   * Suspend user account (admin only)
   * @param {string} userId - User ID to suspend
   * @param {string} adminUserId - Admin user ID
   * @param {string} reason - Suspension reason
   * @returns {object} Suspension result
   */
  async suspendUser(userId, adminUserId, reason) {
    try {
      const adminUser = this.users.get(adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          error: 'Unauthorized access',
          code: 'UNAUTHORIZED'
        };
      }

      const user = this.users.get(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      user.suspend(adminUserId, reason);
      this.users.set(userId, user);

      // Save to persistent storage
      await this.saveUsers();

      this.logger.logAuthEvent('user_suspended', {
        userId: user.id,
        username: user.username,
        adminUserId: adminUserId,
        adminUsername: adminUser.username,
        reason
      }, true);

      return {
        success: true,
        message: 'User suspended successfully',
        user: user.getSafeData()
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'suspend_user',
        userId,
        adminUserId,
        reason
      });

      return {
        success: false,
        error: 'Failed to suspend user',
        code: 'SUSPENSION_ERROR'
      };
    }
  }

  /**
   * Get user statistics
   * @param {string} adminUserId - Admin user ID
   * @returns {object} Statistics result
   */
  getUserStats(adminUserId) {
    try {
      const adminUser = this.users.get(adminUserId);
      if (!adminUser || !adminUser.isAdmin()) {
        return {
          success: false,
          error: 'Unauthorized access',
          code: 'UNAUTHORIZED'
        };
      }

      const users = Array.from(this.users.values());
      
      const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        pending: users.filter(u => u.status === 'pending').length,
        suspended: users.filter(u => u.status === 'suspended').length,
        rejected: users.filter(u => u.status === 'rejected').length,
        admins: users.filter(u => u.isAdmin()).length,
        locked: users.filter(u => u.isLocked()).length
      };

      return {
        success: true,
        stats
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_user_stats',
        adminUserId
      });

      return {
        success: false,
        error: 'Failed to retrieve user statistics',
        code: 'STATS_ERROR'
      };
    }
  }

  /**
   * Check if username is available
   * @param {string} username - Username to check
   * @returns {object} Availability result
   */
  isUsernameAvailable(username) {
    const exists = Array.from(this.users.values())
      .some(user => user.username === username.toLowerCase());
    
    return {
      success: true,
      available: !exists,
      message: exists ? 'Username is already taken' : 'Username is available'
    };
  }

  /**
   * Check if email is available
   * @param {string} email - Email to check
   * @returns {object} Availability result
   */
  isEmailAvailable(email) {
    const exists = Array.from(this.users.values())
      .some(user => user.email === email.toLowerCase());
    
    return {
      success: true,
      available: !exists,
      message: exists ? 'Email is already registered' : 'Email is available'
    };
  }
}

module.exports = UserService;
