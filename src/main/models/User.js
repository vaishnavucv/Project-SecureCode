const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * User Model
 * Represents user accounts with authentication and authorization
 * Following OWASP best practices for user management
 */
class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.username = data.username || '';
    this.email = data.email || '';
    this.passwordHash = data.passwordHash || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.role = data.role || 'user'; // user, admin
    this.status = data.status || 'pending'; // pending, active, suspended, rejected
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLogin = data.lastLogin || null;
    this.loginAttempts = data.loginAttempts || 0;
    this.lockedUntil = data.lockedUntil || null;
    this.emailVerified = data.emailVerified || false;
    this.twoFactorEnabled = data.twoFactorEnabled || false;
    this.metadata = data.metadata || {};
  }

  /**
   * Create user from registration data
   * @param {object} registrationData - Registration form data
   * @returns {User} New User instance
   */
  static async fromRegistration(registrationData) {
    const {
      username,
      email,
      password,
      firstName,
      lastName
    } = registrationData;

    // Validate input
    const validation = User.validateRegistrationData(registrationData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    return new User({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'user',
      status: 'pending'
    });
  }

  /**
   * Validate registration data
   * @param {object} data - Registration data
   * @returns {object} Validation result
   */
  static validateRegistrationData(data) {
    const errors = [];

    // Username validation
    if (!data.username || typeof data.username !== 'string') {
      errors.push('Username is required');
    } else if (data.username.length < 3 || data.username.length > 30) {
      errors.push('Username must be 3-30 characters long');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Email validation
    if (!data.email || typeof data.email !== 'string') {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Valid email address is required');
    }

    // Password validation
    if (!data.password || typeof data.password !== 'string') {
      errors.push('Password is required');
    } else if (data.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
      errors.push('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }

    // Name validation
    if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length === 0) {
      errors.push('First name is required');
    }
    if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify password
   * @param {string} password - Plain text password
   * @returns {boolean} True if password is correct
   */
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  /**
   * Update password
   * @param {string} newPassword - New plain text password
   */
  async updatePassword(newPassword) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Check if user account is locked
   * @returns {boolean} True if account is locked
   */
  isLocked() {
    return !!(this.lockedUntil && this.lockedUntil > Date.now());
  }

  /**
   * Increment login attempts and lock account if necessary
   */
  incrementLoginAttempts() {
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours

    this.loginAttempts += 1;
    this.updatedAt = new Date().toISOString();

    if (this.loginAttempts >= maxAttempts && !this.isLocked()) {
      this.lockedUntil = Date.now() + lockTime;
    }
  }

  /**
   * Reset login attempts after successful login
   */
  resetLoginAttempts() {
    this.loginAttempts = 0;
    this.lockedUntil = null;
    this.lastLogin = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Approve user account
   * @param {string} approvedBy - Admin user ID who approved
   */
  approve(approvedBy) {
    this.status = 'active';
    this.updatedAt = new Date().toISOString();
    this.metadata.approvedBy = approvedBy;
    this.metadata.approvedAt = new Date().toISOString();
  }

  /**
   * Reject user account
   * @param {string} rejectedBy - Admin user ID who rejected
   * @param {string} reason - Reason for rejection
   */
  reject(rejectedBy, reason) {
    this.status = 'rejected';
    this.updatedAt = new Date().toISOString();
    this.metadata.rejectedBy = rejectedBy;
    this.metadata.rejectedAt = new Date().toISOString();
    this.metadata.rejectionReason = reason;
  }

  /**
   * Suspend user account
   * @param {string} suspendedBy - Admin user ID who suspended
   * @param {string} reason - Reason for suspension
   */
  suspend(suspendedBy, reason) {
    this.status = 'suspended';
    this.updatedAt = new Date().toISOString();
    this.metadata.suspendedBy = suspendedBy;
    this.metadata.suspendedAt = new Date().toISOString();
    this.metadata.suspensionReason = reason;
  }

  /**
   * Check if user is active
   * @returns {boolean} True if user is active
   */
  isActive() {
    return this.status === 'active' && !this.isLocked();
  }

  /**
   * Check if user is admin
   * @returns {boolean} True if user is admin
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Get user's full name
   * @returns {string} Full name
   */
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Get safe user data (without sensitive information)
   * @returns {object} Safe user data
   */
  getSafeData() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      status: this.status,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
      emailVerified: this.emailVerified,
      twoFactorEnabled: this.twoFactorEnabled
    };
  }

  /**
   * Convert to database object
   * @returns {object} Database object
   */
  toObject() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
      loginAttempts: this.loginAttempts,
      lockedUntil: this.lockedUntil,
      emailVerified: this.emailVerified,
      twoFactorEnabled: this.twoFactorEnabled,
      metadata: JSON.stringify(this.metadata)
    };
  }

  /**
   * Create from database object
   * @param {object} dbObject - Database object
   * @returns {User} User instance
   */
  static fromDatabase(dbObject) {
    const user = new User(dbObject);
    
    // Parse metadata JSON if it exists
    if (dbObject.metadata && typeof dbObject.metadata === 'string') {
      try {
        user.metadata = JSON.parse(dbObject.metadata);
      } catch (error) {
        console.warn('Failed to parse user metadata JSON:', error.message);
        user.metadata = {};
      }
    }

    return user;
  }

  /**
   * Validate login credentials
   * @param {string} username - Username or email
   * @param {string} password - Password
   * @returns {object} Validation result
   */
  static validateLoginCredentials(username, password) {
    const errors = [];

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      errors.push('Username or email is required');
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if username is available
   * @param {string} username - Username to check
   * @returns {boolean} True if username is valid format
   */
  static isValidUsername(username) {
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
  }

  /**
   * Check if email is valid
   * @param {string} email - Email to check
   * @returns {boolean} True if email is valid
   */
  static isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

module.exports = User;
