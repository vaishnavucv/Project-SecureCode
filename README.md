# Secure File Upload Application

A secure file upload web application built following OWASP best practices for secure coding, file management, and application security verification standards.

## 🛡️ Security Features

- **Input Validation**: Comprehensive file validation including extension, MIME type, content, and size checks
- **Path Traversal Protection**: Prevents directory traversal attacks through filename sanitization
- **File Isolation**: Files stored outside web root with restricted permissions
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Secure Logging**: Structured logging without sensitive information exposure
- **Authentication**: User-based access control for file operations
- **Virus Scanning**: Optional virus scanning integration
- **Content Validation**: Magic number verification and file signature validation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- Docker (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Project_Secure_Coding
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

### Using Docker

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

## 📚 API Documentation

### Authentication

All API endpoints require authentication via the `X-User-ID` header:

```bash
curl -H "X-User-ID: user123" http://localhost:3000/api/health
```

### Endpoints

#### Upload File
```http
POST /api/upload
Content-Type: multipart/form-data
X-User-ID: user123

file: [file]
metadata: {"description": "Optional metadata"}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "filename": "original-filename.txt",
    "fileSize": 1024,
    "mimeType": "text/plain",
    "uploadTimestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Download File
```http
GET /api/files/{fileId}
X-User-ID: user123
```

#### Delete File
```http
DELETE /api/files/{fileId}
X-User-ID: user123
```

#### List User Files
```http
GET /api/files?limit=50&offset=0&status=active
X-User-ID: user123
```

#### Get File Metadata
```http
GET /api/files/{fileId}/metadata
X-User-ID: user123
```

#### Health Check
```http
GET /api/health
```

## 🔧 Configuration

The application uses `config.yaml` for configuration. Key settings:

```yaml
security:
  max_file_size_mb: 10
  allowed_extensions: [".png", ".jpg", ".pdf", ".txt"]
  storage_path: "./uploads"
  storage_permissions: "644"

server:
  port: 3000
  environment: "development"

logging:
  level: "info"
  log_path: "./logs"
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

## 🧪 Testing

### Run Tests

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

### Test Structure

```
tests/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests for API endpoints
└── setup.js       # Test setup and configuration
```

## 🔒 Security Considerations

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

## 📁 Project Structure

```
src/
├── main/
│   ├── controllers/    # API controllers
│   ├── services/       # Business logic
│   ├── validation/     # Input validation
│   ├── storage/        # File storage management
│   ├── models/         # Data models
│   ├── config/         # Configuration management
│   └── app.js          # Main application
├── tests/              # Test files
├── uploads/            # File storage directory
├── logs/               # Log files
└── data/               # Database files
```

## 🚀 Deployment

### Production Deployment

1. **Set production environment variables**
2. **Configure reverse proxy (Nginx)**
3. **Set up SSL/TLS certificates**
4. **Configure monitoring and logging**
5. **Run security audit**

See `DEPLOYMENT.md` for detailed deployment instructions.

### Docker Deployment

```bash
# Build image
docker build -t secure-file-upload .

# Run container
docker run -d \
  --name secure-file-upload \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET="your-secret" \
  -v uploads:/app/uploads \
  -v logs:/app/logs \
  secure-file-upload
```

## 📊 Monitoring

### Health Checks

- **Application Health**: `GET /api/health`
- **Service Statistics**: `GET /api/stats`

### Logging

Logs are written to:
- `logs/app.log` - General application logs
- `logs/security.log` - Security events
- `logs/error.log` - Error logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in `/docs`
- Review the security audit in `SELF_AUDIT.md`
- Open an issue on GitHub

## 🔄 Changelog

### Version 1.0.0
- Initial release
- OWASP-compliant file upload system
- Comprehensive security controls
- Docker support
- Complete test suite
