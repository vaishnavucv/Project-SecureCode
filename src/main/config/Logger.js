const winston = require('winston');
const path = require('path');
const config = require('./AppConfig');

/**
 * Logger - Secure Logging System
 * Implements OWASP best practices for secure logging
 * Avoids logging sensitive information and provides structured logging
 */
class Logger {
  constructor() {
    this.loggingConfig = config.getLoggingConfig();
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger with secure configuration
   * @returns {winston.Logger} Configured logger instance
   */
  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        // Sanitize sensitive information
        const sanitizedMeta = this.sanitizeLogData(meta);
        
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...sanitizedMeta
        });
      })
    );

    const transports = [];

    // Console transport for development
    if (config.isDevelopment()) {
      transports.push(
        new winston.transports.Console({
          level: this.loggingConfig.level,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
    }

    // File transport for all environments
    if (this.loggingConfig.log_path) {
      const logDir = path.resolve(this.loggingConfig.log_path);
      
      // General application logs
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          level: this.loggingConfig.level,
          format: logFormat,
          maxsize: this.parseFileSize(this.loggingConfig.max_file_size),
          maxFiles: this.loggingConfig.max_files,
          tailable: true
        })
      );

      // Security-specific logs
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'security.log'),
          level: 'info',
          format: logFormat,
          maxsize: this.parseFileSize(this.loggingConfig.max_file_size),
          maxFiles: this.loggingConfig.max_files,
          tailable: true
        })
      );

      // Error logs
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: this.parseFileSize(this.loggingConfig.max_file_size),
          maxFiles: this.loggingConfig.max_files,
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: this.loggingConfig.level,
      format: logFormat,
      transports,
      exitOnError: false
    });
  }

  /**
   * Sanitize log data to remove sensitive information
   * Following OWASP guidelines for secure logging
   * @param {object} data - Log data to sanitize
   * @returns {object} Sanitized log data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Remove or mask sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
      'filePath', // Don't log full file paths
      'fileContent', // Never log file contents
      'buffer', // Don't log file buffers
      'checksum' // Don't log checksums in general logs
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (field === 'filePath') {
          // Log only filename, not full path
          sanitized[field] = path.basename(sanitized[field]);
        } else {
          // Mask sensitive data
          sanitized[field] = '[REDACTED]';
        }
      }
    }

    // Sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  /**
   * Parse file size string to bytes
   * @param {string} sizeStr - Size string (e.g., "10m", "1g")
   * @returns {number} Size in bytes
   */
  parseFileSize(sizeStr) {
    if (!sizeStr) return 10 * 1024 * 1024; // Default 10MB

    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)([bkmg]?)$/);
    if (!match) return 10 * 1024 * 1024;

    const size = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(size * (units[unit] || 1));
  }

  /**
   * Log security event
   * @param {string} event - Event type
   * @param {object} data - Event data
   * @param {string} level - Log level
   */
  logSecurityEvent(event, data, level = 'info') {
    const securityData = {
      type: 'security_event',
      event,
      ...this.sanitizeLogData(data),
      timestamp: new Date().toISOString()
    };

    this.logger.log(level, `Security Event: ${event}`, securityData);
  }

  /**
   * Log file upload event
   * @param {string} action - Action (upload, download, delete)
   * @param {object} data - Event data
   * @param {boolean} success - Whether action was successful
   */
  logFileEvent(action, data, success = true) {
    const level = success ? 'info' : 'warn';
    const eventData = {
      type: 'file_event',
      action,
      success,
      ...this.sanitizeLogData(data),
      timestamp: new Date().toISOString()
    };

    this.logger.log(level, `File ${action}: ${success ? 'success' : 'failed'}`, eventData);
  }

  /**
   * Log validation failure
   * @param {string} reason - Failure reason
   * @param {object} data - Event data
   */
  logValidationFailure(reason, data) {
    const eventData = {
      type: 'validation_failure',
      reason,
      ...this.sanitizeLogData(data),
      timestamp: new Date().toISOString()
    };

    this.logger.warn('Validation failed', eventData);
  }

  /**
   * Log authentication event
   * @param {string} action - Action (login, logout, failed_login)
   * @param {object} data - Event data
   * @param {boolean} success - Whether action was successful
   */
  logAuthEvent(action, data, success = true) {
    const level = success ? 'info' : 'warn';
    const eventData = {
      type: 'auth_event',
      action,
      success,
      ...this.sanitizeLogData(data),
      timestamp: new Date().toISOString()
    };

    this.logger.log(level, `Auth ${action}: ${success ? 'success' : 'failed'}`, eventData);
  }

  /**
   * Log system error
   * @param {Error} error - Error object
   * @param {object} context - Additional context
   */
  logError(error, context = {}) {
    const errorData = {
      type: 'system_error',
      message: error.message,
      stack: error.stack,
      ...this.sanitizeLogData(context),
      timestamp: new Date().toISOString()
    };

    this.logger.error('System error', errorData);
  }

  /**
   * Log access attempt
   * @param {string} resource - Resource being accessed
   * @param {string} userId - User ID
   * @param {boolean} authorized - Whether access was authorized
   */
  logAccessAttempt(resource, userId, authorized = true) {
    const eventData = {
      type: 'access_attempt',
      resource,
      userId,
      authorized,
      timestamp: new Date().toISOString()
    };

    const level = authorized ? 'info' : 'warn';
    this.logger.log(level, `Access attempt: ${resource}`, eventData);
  }

  /**
   * Log rate limit event
   * @param {string} userId - User ID
   * @param {string} action - Action being rate limited
   * @param {number} attempts - Number of attempts
   */
  logRateLimit(userId, action, attempts) {
    const eventData = {
      type: 'rate_limit',
      userId,
      action,
      attempts,
      timestamp: new Date().toISOString()
    };

    this.logger.warn('Rate limit exceeded', eventData);
  }

  /**
   * Log configuration change
   * @param {string} setting - Configuration setting
   * @param {any} oldValue - Old value
   * @param {any} newValue - New value
   */
  logConfigChange(setting, oldValue, newValue) {
    const eventData = {
      type: 'config_change',
      setting,
      oldValue: this.sanitizeLogData({ value: oldValue }).value,
      newValue: this.sanitizeLogData({ value: newValue }).value,
      timestamp: new Date().toISOString()
    };

    this.logger.info('Configuration changed', eventData);
  }

  /**
   * Get logger instance for direct use
   * @returns {winston.Logger} Logger instance
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Create child logger with additional context
   * @param {object} context - Additional context to include in all logs
   * @returns {winston.Logger} Child logger
   */
  child(context) {
    return this.logger.child(context);
  }

  /**
   * Close logger and all transports
   */
  close() {
    this.logger.close();
  }
}

// Export singleton instance
module.exports = new Logger();
