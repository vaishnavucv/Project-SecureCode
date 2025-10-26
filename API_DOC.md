# API Documentation

## Secure File Upload API

This document provides comprehensive API documentation for the Secure File Upload Application.

**Base URL**: `http://localhost:3000/api`  
**Version**: 1.0.0  
**Authentication**: Header-based (X-User-ID)

---

## Authentication

All API endpoints require authentication via the `X-User-ID` header:

```http
X-User-ID: user123
```

**User ID Format**: 3-50 characters, alphanumeric with underscores and hyphens only.

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details (optional)"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_USER_ID` | 401 | Invalid user ID format |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NO_FILE` | 400 | No file uploaded |
| `INVALID_FILE_ID` | 400 | Invalid file ID format |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 403 | Unauthorized access |
| `RATE_LIMIT` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Endpoints

### 1. Upload File

Upload a file to the secure storage system.

**Endpoint**: `POST /api/upload`

**Headers**:
```http
X-User-ID: user123
Content-Type: multipart/form-data
```

**Request Body**:
- `file` (file, required): The file to upload
- `metadata` (string, optional): JSON string with additional metadata

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "X-User-ID: user123" \
  -F "file=@document.pdf" \
  -F "metadata={\"description\": \"Important document\"}"
```

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "fileId": "12345678-1234-1234-1234-123456789012",
    "filename": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "uploadTimestamp": "2024-01-01T12:00:00.000Z"
  },
  "warnings": []
}
```

**Error Responses**:
- **400**: Validation error, file too large, invalid file type
- **401**: Authentication required
- **429**: Rate limit exceeded

**Validation Rules**:
- File size: Maximum 10MB (configurable)
- Allowed extensions: .png, .jpg, .jpeg, .gif, .pdf, .doc, .docx, .txt, .csv, .xlsx
- Filename: No path traversal characters, max 255 characters

---

### 2. Download File

Download a file by its ID.

**Endpoint**: `GET /api/files/{fileId}`

**Headers**:
```http
X-User-ID: user123
```

**Path Parameters**:
- `fileId` (string, required): The file ID

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012 \
  -H "X-User-ID: user123" \
  -O
```

**Success Response** (200):
- **Content-Type**: File MIME type
- **Content-Disposition**: `attachment; filename="original-filename.ext"`
- **Body**: File content

**Error Responses**:
- **400**: Invalid file ID
- **401**: Authentication required
- **403**: Unauthorized access
- **404**: File not found

---

### 3. Delete File

Delete a file by its ID.

**Endpoint**: `DELETE /api/files/{fileId}`

**Headers**:
```http
X-User-ID: user123
```

**Path Parameters**:
- `fileId` (string, required): The file ID

**Example Request**:
```bash
curl -X DELETE http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012 \
  -H "X-User-ID: user123"
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "File deleted successfully",
  "deletedFileId": "12345678-1234-1234-1234-123456789012",
  "deletedAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses**:
- **400**: Invalid file ID
- **401**: Authentication required
- **403**: Unauthorized access
- **404**: File not found

---

### 4. List User Files

Get a list of files uploaded by the user.

**Endpoint**: `GET /api/files`

**Headers**:
```http
X-User-ID: user123
```

**Query Parameters**:
- `limit` (number, optional): Maximum number of files to return (default: 50, max: 100)
- `offset` (number, optional): Number of files to skip (default: 0)
- `status` (string, optional): Filter by file status (active, deleted, quarantined) (default: active)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/files?limit=10&offset=0&status=active" \
  -H "X-User-ID: user123"
```

**Success Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "12345678-1234-1234-1234-123456789012",
      "originalFilename": "document.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf",
      "uploadTimestamp": "2024-01-01T12:00:00.000Z",
      "lastAccessed": "2024-01-01T13:00:00.000Z",
      "accessCount": 5,
      "status": "active",
      "virusScanStatus": "clean"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

**Error Responses**:
- **400**: Invalid query parameters
- **401**: Authentication required

---

### 5. Get File Metadata

Get detailed metadata for a specific file.

**Endpoint**: `GET /api/files/{fileId}/metadata`

**Headers**:
```http
X-User-ID: user123
```

**Path Parameters**:
- `fileId` (string, required): The file ID

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012/metadata \
  -H "X-User-ID: user123"
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "12345678-1234-1234-1234-123456789012",
    "originalFilename": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "uploadTimestamp": "2024-01-01T12:00:00.000Z",
    "lastAccessed": "2024-01-01T13:00:00.000Z",
    "accessCount": 5,
    "status": "active",
    "virusScanStatus": "clean",
    "checksum": "sha256:abc123def456..."
  }
}
```

**Error Responses**:
- **400**: Invalid file ID
- **401**: Authentication required
- **403**: Unauthorized access
- **404**: File not found

---

### 6. Health Check

Check the health status of the API.

**Endpoint**: `GET /api/health`

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/health
```

**Success Response** (200):
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "stats": {
    "totalFiles": 150,
    "activeFiles": 145,
    "deletedFiles": 5,
    "storage": {
      "fileCount": 145,
      "totalSize": 52428800,
      "totalSizeFormatted": "50 MB"
    }
  }
}
```

---

### 7. Service Statistics

Get service statistics (requires authentication).

**Endpoint**: `GET /api/stats`

**Headers**:
```http
X-User-ID: user123
```

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/stats \
  -H "X-User-ID: user123"
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "totalFiles": 150,
    "activeFiles": 145,
    "deletedFiles": 5,
    "storage": {
      "fileCount": 145,
      "totalSize": 52428800,
      "totalSizeFormatted": "50 MB",
      "storagePath": "/app/uploads"
    }
  }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

### General API Rate Limiting
- **Window**: 15 minutes
- **Limit**: 100 requests per window per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Upload Rate Limiting
- **Window**: 5 minutes
- **Limit**: 10 uploads per window per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 900
}
```

---

## File Validation

### Allowed File Types

| Extension | MIME Type | Description |
|-----------|-----------|-------------|
| .png | image/png | PNG images |
| .jpg, .jpeg | image/jpeg | JPEG images |
| .gif | image/gif | GIF images |
| .pdf | application/pdf | PDF documents |
| .doc | application/msword | Word documents |
| .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | Word documents (new format) |
| .txt | text/plain | Text files |
| .csv | text/csv | CSV files |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Excel files |

### File Size Limits
- **Maximum file size**: 10MB (configurable)
- **Minimum file size**: 1 byte
- **Empty files**: Not allowed

### Filename Restrictions
- **Maximum length**: 255 characters
- **Prohibited characters**: `../`, `./`, `\`, `<`, `>`, `:`, `"`, `|`, `?`, `*`
- **Path traversal**: Not allowed
- **Empty filenames**: Not allowed

---

## Security Features

### Input Validation
- File extension whitelist validation
- MIME type verification using multiple methods
- File content validation (magic number detection)
- File size validation
- Filename sanitization

### Access Control
- User-based authentication required
- File ownership validation
- Unauthorized access logging

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### Logging
- All file operations logged
- Security events logged separately
- Sensitive information redacted
- Structured JSON logging

---

## Examples

### Complete Upload Workflow

```bash
# 1. Upload a file
curl -X POST http://localhost:3000/api/upload \
  -H "X-User-ID: user123" \
  -F "file=@document.pdf" \
  -F "metadata={\"description\": \"Important document\"}"

# Response:
# {
#   "success": true,
#   "data": {
#     "fileId": "12345678-1234-1234-1234-123456789012",
#     "filename": "document.pdf",
#     "fileSize": 1024000,
#     "mimeType": "application/pdf",
#     "uploadTimestamp": "2024-01-01T12:00:00.000Z"
#   }
# }

# 2. List user files
curl -X GET http://localhost:3000/api/files \
  -H "X-User-ID: user123"

# 3. Download the file
curl -X GET http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012 \
  -H "X-User-ID: user123" \
  -O

# 4. Get file metadata
curl -X GET http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012/metadata \
  -H "X-User-ID: user123"

# 5. Delete the file
curl -X DELETE http://localhost:3000/api/files/12345678-1234-1234-1234-123456789012 \
  -H "X-User-ID: user123"
```

### Error Handling Example

```bash
# Upload invalid file type
curl -X POST http://localhost:3000/api/upload \
  -H "X-User-ID: user123" \
  -F "file=@malicious.exe"

# Response:
# {
#   "success": false,
#   "error": "File validation failed",
#   "details": ["File extension '.exe' is not allowed. Allowed extensions: .png, .jpg, .jpeg, .gif, .pdf, .doc, .docx, .txt, .csv, .xlsx"]
# }
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');

async function uploadFile(userId, filePath, metadata = {}) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('metadata', JSON.stringify(metadata));

  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: {
      'X-User-ID': userId,
      ...form.getHeaders()
    },
    body: form
  });

  return await response.json();
}

// Usage
uploadFile('user123', './document.pdf', { description: 'Important document' })
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

### Python

```python
import requests

def upload_file(user_id, file_path, metadata=None):
    url = 'http://localhost:3000/api/upload'
    headers = {'X-User-ID': user_id}
    
    files = {'file': open(file_path, 'rb')}
    data = {'metadata': json.dumps(metadata or {})}
    
    response = requests.post(url, headers=headers, files=files, data=data)
    return response.json()

# Usage
result = upload_file('user123', './document.pdf', {'description': 'Important document'})
print(result)
```

---

## Support

For API support and questions:
- Check the health endpoint: `GET /api/health`
- Review the service statistics: `GET /api/stats`
- Check application logs for detailed error information
- Refer to the security audit: `SELF_AUDIT.md`
