const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

/**
 * Application Configuration Manager
 * Handles loading and validation of configuration from YAML and environment variables
 * Following OWASP best practices for secure configuration management
 */
class AppConfig {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  /**
   * Load configuration from YAML file and environment variables
   * Environment variables take precedence over YAML configuration
   */
  loadConfig() {
    try {
      // Load base configuration from YAML file
      const configPath = path.join(process.cwd(), 'config.yaml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.parse(configFile);

      // Override with environment variables
      this.overrideWithEnvVars();

      // Validate configuration
      this.validateConfig();

      console.log('Configuration loaded successfully');
    } catch (error) {
      console.error('Error loading configuration:', error.message);
      process.exit(1);
    }
  }

  /**
   * Override configuration with environment variables
   * Following OWASP guidelines for secure configuration
   */
  overrideWithEnvVars() {
    // Server configuration
    if (process.env.PORT) {
      this.config.server.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.NODE_ENV) {
      this.config.server.environment = process.env.NODE_ENV;
    }

    // Security configuration
    if (process.env.MAX_FILE_SIZE_MB) {
      this.config.security.max_file_size_mb = parseInt(process.env.MAX_FILE_SIZE_MB, 10);
    }
    if (process.env.ALLOWED_EXTENSIONS) {
      this.config.security.allowed_extensions = process.env.ALLOWED_EXTENSIONS.split(',');
    }
    if (process.env.STORAGE_PATH) {
      this.config.security.storage_path = process.env.STORAGE_PATH;
    }
    if (process.env.SESSION_SECRET) {
      this.config.security.session_secret = process.env.SESSION_SECRET;
    }
    if (process.env.JWT_SECRET) {
      this.config.security.jwt_secret = process.env.JWT_SECRET;
    }

    // Database configuration
    if (process.env.DATABASE_URL) {
      this.config.database.url = process.env.DATABASE_URL;
    }
    if (process.env.DATABASE_TYPE) {
      this.config.database.type = process.env.DATABASE_TYPE;
    }

    // Logging configuration
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL;
    }
    if (process.env.LOG_PATH) {
      this.config.logging.log_path = process.env.LOG_PATH;
    }
  }

  /**
   * Validate configuration for security and completeness
   * Following OWASP input validation guidelines
   */
  validateConfig() {
    const errors = [];

    // Validate server configuration
    if (!this.config.server.port || this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Invalid server port configuration');
    }

    // Validate security configuration
    if (!this.config.security.max_file_size_mb || this.config.security.max_file_size_mb < 1) {
      errors.push('Invalid max file size configuration');
    }

    if (!Array.isArray(this.config.security.allowed_extensions) || 
        this.config.security.allowed_extensions.length === 0) {
      errors.push('Invalid allowed extensions configuration');
    }

    // Validate file extensions for security
    const allowedExtensions = this.config.security.allowed_extensions;
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh'];
    const hasDangerousExtensions = allowedExtensions.some(ext => 
      dangerousExtensions.includes(ext.toLowerCase())
    );

    if (hasDangerousExtensions) {
      errors.push('Configuration contains potentially dangerous file extensions');
    }

    // Validate storage path
    if (!this.config.security.storage_path) {
      errors.push('Storage path not configured');
    }

    // Validate session secret for production
    if (this.config.server.environment === 'production') {
      if (!this.config.security.session_secret || 
          this.config.security.session_secret === 'your-super-secret-session-key-change-in-production') {
        errors.push('Session secret must be changed for production');
      }
      if (!this.config.security.jwt_secret || 
          this.config.security.jwt_secret === 'your-super-secret-jwt-key-change-in-production') {
        errors.push('JWT secret must be changed for production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot notation path to configuration value
   * @returns {any} Configuration value
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  /**
   * Get all configuration
   * @returns {object} Complete configuration object
   */
  getAll() {
    return this.config;
  }

  /**
   * Check if running in production environment
   * @returns {boolean} True if production environment
   */
  isProduction() {
    return this.config.server.environment === 'production';
  }

  /**
   * Check if running in development environment
   * @returns {boolean} True if development environment
   */
  isDevelopment() {
    return this.config.server.environment === 'development';
  }

  /**
   * Get security configuration
   * @returns {object} Security configuration object
   */
  getSecurityConfig() {
    return this.config.security;
  }

  /**
   * Get logging configuration
   * @returns {object} Logging configuration object
   */
  getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * Get database configuration
   * @returns {object} Database configuration object
   */
  getDatabaseConfig() {
    return this.config.database;
  }
}

// Export singleton instance
module.exports = new AppConfig();
