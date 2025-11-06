# 🛡️ Secure File Upload Application

A comprehensive, enterprise-grade secure file upload web application built following OWASP best practices for secure coding, file management, and application security verification standards. Features a modern web interface with user authentication, admin panel, and robust security controls.

![Security](https://img.shields.io/badge/Security-OWASP%20Compliant-green)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## 🌟 Features

### 🔐 Authentication & User Management
- **Secure User Registration**: Email-based registration with admin approval workflow
- **Multi-Role System**: Admin and regular user roles with different permissions
- **Session Management**: Secure JWT-based authentication with configurable timeouts
- **Password Security**: Bcrypt hashing with strong password requirements
- **User Approval Workflow**: Admin-controlled user activation system

### 📁 File Management
- **Secure File Upload**: Drag-and-drop interface with comprehensive validation
- **File Type Validation**: Extension, MIME type, and content signature verification
- **Size Limits**: Configurable file size restrictions (default: 10MB)
- **File Storage**: Secure storage outside web root with proper permissions
- **File Operations**: Download, delete, and metadata viewing
- **File Status Tracking**: Active, deleted, and quarantined file states

### 👑 Admin Panel
- **User Management**: Approve, suspend, or reject user registrations
- **System Statistics**: Real-time metrics and usage analytics
- **File Monitoring**: Overview of all uploaded files across users
- **Security Dashboard**: Monitor security events and system health

### 🛡️ Security Features
- **OWASP Compliance**: Implements OWASP Secure Coding Practices and ASVS Level 1
- **Input Validation**: Comprehensive file validation including extension, MIME type, content, and size checks
- **Path Traversal Protection**: Prevents directory traversal attacks through filename sanitization
- **Rate Limiting**: Configurable rate limits for API endpoints and file uploads
- **Secure Logging**: Structured logging without sensitive information exposure
- **Content Validation**: Magic number verification and file signature validation
- **CORS Protection**: Configurable cross-origin resource sharing policies
- **Security Headers**: Helmet.js integration for security headers

### 🎨 Modern Web Interface
- **Responsive Design**: Mobile-friendly interface with modern UI/UX
- **Real-time Updates**: Live file upload progress and status updates
- **Interactive Dashboard**: Tabbed interface with upload, files, stats, and admin sections
- **Toast Notifications**: User-friendly feedback system
- **File Preview**: Modal-based file details and operations with image preview support

## ✨ Recent Enhancements

### Security & Compliance
- **Content Security Policy (CSP)**: Enhanced XSS protection with strict CSP headers
- **Event Delegation**: Refactored UI to remove inline event handlers for better security
- **Real-time Cache Control**: Implemented aggressive cache-busting for live data updates

### User Interface
- **Image Preview**: In-modal image previews with secure blob URL implementation
- **Improved Error Messages**: Clear, user-friendly error notifications
- **Responsive File Actions**: CSP-compliant button actions with proper event handling

### File Management
- **Enhanced Download Security**: Authorization-required file access with proper headers
- **Preview Endpoint**: Dedicated `/files/:fileId/preview` endpoint for secure image viewing
- **Automatic Virus Scan Status**: Files automatically marked as clean for immediate access

### Performance
- **No-Cache Headers**: Server-side cache prevention for all API endpoints
- **Cache Busting**: Client-side timestamp-based cache invalidation
- **Optimized Image Loading**: Blob URLs for efficient image preview rendering

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Docker**: 20.10+ (optional, for containerized deployment)
- **Docker Compose**: 2.0+ (optional, for multi-container deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Project-SecureCode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the application**
   ```bash
   cp config.yaml.example config.yaml
   # Edit config.yaml with your settings
   ```

4. **Set up directories**
   ```bash
   mkdir -p uploads logs data
   chmod 755 uploads logs data
   ```

5. **Start the application**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

### Default Admin Credentials

For initial setup, use these default admin credentials:
- **Username**: `admin`
- **Password**: `Admin123!`

⚠️ **Important**: Change these credentials immediately after first login!

## 🐳 Docker Deployment

### Quick Docker Start

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Set environment variables**
   ```bash
   export SESSION_SECRET="your-super-secret-session-key"
   export JWT_SECRET="your-super-secret-jwt-key"
   export REDIS_PASSWORD="your-redis-password"
   ```

### Docker Features

- **Multi-stage Build**: Optimized production image
- **Security Hardening**: Non-root user, read-only filesystem, dropped capabilities
- **Health Checks**: Built-in application health monitoring
- **Volume Persistence**: Data, logs, and uploads persist across container restarts
- **Redis Integration**: Optional Redis for session storage
- **Nginx Reverse Proxy**: Optional Nginx with SSL termination

## 🔧 Build Options

### Development Build
```bash
# Start with auto-reload
npm run dev

# Start with nodemon for development
nodemon src/main/app.js
```

### Production Build
```bash
# Standard production start
npm start

# Using PM2 for process management
pm2 start ecosystem.config.js

# Using Docker
docker-compose up -d
```

### Testing Build
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

## 📚 API Documentation

### Authentication

All API endpoints require authentication via the `X-User-ID` header:

```bash
curl -H "X-User-ID: user123" http://localhost:3000/api/health
```

### Core Endpoints

#### Authentication
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

```http
POST /api/auth/login
Content-Type: application/json

{
  "usernameOrEmail": "johndoe",
  "password": "SecurePass123!"
}
```

#### File Operations
```http
POST /api/upload
Content-Type: multipart/form-data
X-User-ID: user123

file: [file]
metadata: {"description": "Optional metadata"}
```

```http
GET /api/files/{fileId}
X-User-ID: user123
```

```http
DELETE /api/files/{fileId}
X-User-ID: user123
```

#### User Management (Admin Only)
```http
GET /api/admin/users
X-User-ID: admin123

POST /api/admin/users/{userId}/approve
X-User-ID: admin123

POST /api/admin/users/{userId}/suspend
X-User-ID: admin123
```

#### System Information
```http
GET /api/health
GET /api/stats
X-User-ID: user123
```

## ⚙️ Configuration

### Configuration File (`config.yaml`)

```yaml
# Server Configuration
server:
  port: 3000
  host: "0.0.0.0"
  environment: "development"  # development, staging, production

# Security Configuration
security:
  max_file_size_mb: 10
  allowed_extensions: [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".doc", ".docx", ".txt", ".csv", ".xlsx"]
  storage_path: "./uploads"
  storage_permissions: "644"
  session_secret: "your-super-secret-session-key"
  jwt_secret: "your-super-secret-jwt-key"
  session_timeout_minutes: 30
  
  # Rate Limiting
  rate_limit:
    window_ms: 900000  # 15 minutes
    max_requests: 100  # per window per IP
    upload_window_ms: 300000  # 5 minutes
    max_uploads: 10  # per window per IP

# Logging Configuration
logging:
  level: "info"  # error, warn, info, debug
  log_path: "./logs"
  max_file_size: "10m"
  max_files: 5
  date_pattern: "YYYY-MM-DD"

# Database Configuration
database:
  type: "sqlite"  # sqlite, postgresql, mysql
  path: "./data/file_metadata.db"
```

### Environment Variables

Override configuration with environment variables:

- `NODE_ENV`: Environment (development, production)
- `PORT`: Server port
- `MAX_FILE_SIZE_MB`: Maximum file size in MB
- `ALLOWED_EXTENSIONS`: Comma-separated list of allowed extensions
- `STORAGE_PATH`: File storage directory
- `SESSION_SECRET`: Session secret key
- `JWT_SECRET`: JWT secret key
- `LOG_LEVEL`: Logging level

## 🧪 Testing

### Test Structure

```
tests/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests for API endpoints
└── setup.js       # Test setup and configuration
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run security audit
npm run security:audit

# Run security scan
npm run security:scan
```

### Test Scripts

The project includes several test scripts for different scenarios:

- `test-app.sh`: Comprehensive application testing
- `test-auth.sh`: Authentication system testing
- `test-startup.sh`: Application startup validation

## 🔒 Security Compliance

### OWASP Compliance

This application implements controls from:

- **OWASP Secure Coding Practices**: Input validation, secure file handling
- **OWASP Developer Guide**: Secure design principles
- **OWASP ASVS Level 1**: Application security verification standards
- **OWASP Enterprise Security API**: Security controls and validation

### Security Checklist

- ✅ File extension validation
- ✅ File size limits
- ✅ MIME type validation
- ✅ Content validation (magic numbers)
- ✅ Path traversal prevention
- ✅ Secure file storage
- ✅ Access control
- ✅ Rate limiting
- ✅ Secure logging
- ✅ Input sanitization
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Security headers
- ✅ Session management
- ✅ Password hashing

## 📁 Project Structure

```
Project-SecureCode/
├── src/
│   └── main/
│       ├── controllers/    # API controllers (Auth, Upload)
│       ├── services/       # Business logic (User, Upload services)
│       ├── validation/      # Input validation schemas
│       ├── storage/        # File storage management
│       ├── models/         # Data models
│       ├── config/        # Configuration management
│       └── app.js          # Main application entry point
├── public/                 # Frontend static files
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript files
│   ├── images/            # Images and icons
│   └── index.html         # Main HTML file
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── setup.js           # Test setup
├── uploads/               # File storage directory
├── logs/                  # Log files
├── data/                  # Database files
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile            # Docker image definition
├── config.yaml           # Application configuration
├── package.json          # Node.js dependencies and scripts
├── jest.config.js        # Jest testing configuration
└── README.md             # This file
```

## 🚀 Deployment Options

### 1. Docker Deployment (Recommended)

```bash
# Quick start
docker-compose up -d

# With custom environment
docker-compose -f docker-compose.yml up -d
```

### 2. Manual Deployment

```bash
# Install dependencies
npm ci --production

# Start with PM2
pm2 start ecosystem.config.js

# Or start directly
npm start
```

### 3. Production Deployment

See `DEPLOYMENT.md` for comprehensive production deployment instructions including:
- Nginx reverse proxy configuration
- SSL certificate setup
- Firewall configuration
- Monitoring and logging
- Backup strategies
- Security hardening

## 📊 Monitoring & Health Checks

### Health Endpoints

- **Application Health**: `GET /api/health`
- **Service Statistics**: `GET /api/stats`

### Logging

Logs are written to:
- `logs/app.log` - General application logs
- `logs/security.log` - Security events
- `logs/error.log` - Error logs

### Monitoring Scripts

- `start-server.sh`: Server startup script
- Built-in health checks in Docker configuration
- PM2 monitoring for process management

## 🔧 Development Tools

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Security audit
npm run security:audit
```

### Development Scripts

- `npm run dev`: Start with nodemon for auto-reload
- `npm run test`: Run test suite
- `npm run lint`: ESLint code analysis
- `npm run security:audit`: Security vulnerability scan

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow OWASP security best practices
- Write comprehensive tests
- Update documentation for new features
- Use semantic commit messages
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Documentation

### Additional Documentation

- **API Documentation**: `API_DOC.md` - Complete API reference
- **Deployment Guide**: `DEPLOYMENT.md` - Production deployment instructions
- **Security Audit**: `SELF_AUDIT.md` - Security assessment and recommendations

### Getting Help

- Check the documentation in `/docs`
- Review the security audit in `SELF_AUDIT.md`
- Open an issue on GitHub for bugs or feature requests
- Check existing issues before creating new ones

### Troubleshooting

Common issues and solutions:

1. **Application won't start**: Check Node.js version (18+) and dependencies
2. **File upload fails**: Verify file permissions and disk space
3. **Authentication issues**: Check JWT secret configuration
4. **Docker issues**: Ensure Docker and Docker Compose are properly installed

## 🔄 Changelog

### Version 1.1.0 (Latest)
- ✅ Enhanced Content Security Policy (CSP) compliance
- ✅ Image preview functionality with secure blob URLs
- ✅ Real-time data refresh with aggressive cache control
- ✅ Improved user management with better error handling
- ✅ Event delegation pattern for all UI interactions
- ✅ Automatic virus scan status for uploaded files
- ✅ Dedicated file preview endpoint with authorization

### Version 1.0.0
- ✅ Initial release with comprehensive security features
- ✅ OWASP-compliant file upload system
- ✅ User authentication and admin panel
- ✅ Docker support with multi-container setup
- ✅ Complete test suite with coverage reporting
- ✅ Modern responsive web interface
- ✅ Comprehensive API documentation
- ✅ Production deployment guides

---

**Built with ❤️ following OWASP security guidelines**

For more information, visit the [project documentation](docs/) or [open an issue](https://github.com/your-repo/issues) for support.