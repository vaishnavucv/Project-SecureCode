const FileValidator = require('../../src/main/validation/FileValidator');
const path = require('path');

describe('FileValidator', () => {
  let fileValidator;

  beforeEach(() => {
    fileValidator = new FileValidator();
  });

  describe('validateFile', () => {
    it('should validate a valid PNG file', async () => {
      const mockFile = {
        originalname: 'test.png',
        buffer: Buffer.from('fake-png-content'),
        size: 1024,
        mimetype: 'image/png'
      };

      const result = await fileValidator.validateFile(mockFile, 'user123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toBeDefined();
      expect(result.sanitizedData.originalFilename).toBe('test.png');
    });

    it('should reject file with dangerous extension', async () => {
      const mockFile = {
        originalname: 'malicious.exe',
        buffer: Buffer.from('fake-exe-content'),
        size: 1024,
        mimetype: 'application/octet-stream'
      };

      const result = await fileValidator.validateFile(mockFile, 'user123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
    });

    it('should reject file that exceeds size limit', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const mockFile = {
        originalname: 'large.pdf',
        buffer: largeBuffer,
        size: 11 * 1024 * 1024,
        mimetype: 'application/pdf'
      };

      const result = await fileValidator.validateFile(mockFile, 'user123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'));
    });

    it('should reject file with path traversal in filename', async () => {
      const mockFile = {
        originalname: '../../../etc/passwd',
        buffer: Buffer.from('fake-content'),
        size: 1024,
        mimetype: 'text/plain'
      };

      const result = await fileValidator.validateFile(mockFile, 'user123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('path traversal'));
    });

    it('should reject empty file', async () => {
      const mockFile = {
        originalname: 'empty.txt',
        buffer: Buffer.alloc(0),
        size: 0,
        mimetype: 'text/plain'
      };

      const result = await fileValidator.validateFile(mockFile, 'user123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Empty files'));
    });
  });

  describe('validateAndSanitizeFilename', () => {
    it('should sanitize filename with dangerous characters', () => {
      const result = fileValidator.validateAndSanitizeFilename('test<>file.txt');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('dangerous characters'));
    });

    it('should sanitize filename with path traversal', () => {
      const result = fileValidator.validateAndSanitizeFilename('../../../etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('path traversal'));
    });

    it('should accept valid filename', () => {
      const result = fileValidator.validateAndSanitizeFilename('valid-file.txt');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedFilename).toBe('valid-file.txt');
    });

    it('should handle filename that becomes empty after sanitization', () => {
      const result = fileValidator.validateAndSanitizeFilename('...');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('empty after sanitization'));
    });
  });

  describe('validateFileExtension', () => {
    it('should accept allowed extensions', () => {
      const allowedExtensions = ['.png', '.jpg', '.pdf', '.txt'];
      
      allowedExtensions.forEach(ext => {
        const result = fileValidator.validateFileExtension(`test${ext}`);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject disallowed extensions', () => {
      const disallowedExtensions = ['.exe', '.bat', '.js', '.php'];
      
      disallowedExtensions.forEach(ext => {
        const result = fileValidator.validateFileExtension(`test${ext}`);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expect.stringContaining('not allowed'));
      });
    });

    it('should reject file without extension', () => {
      const result = fileValidator.validateFileExtension('testfile');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must have an extension'));
    });
  });

  describe('validateFileSize', () => {
    it('should accept file within size limit', () => {
      const mockFile = {
        size: 5 * 1024 * 1024 // 5MB
      };

      const result = fileValidator.validateFileSize(mockFile);

      expect(result.isValid).toBe(true);
    });

    it('should reject file exceeding size limit', () => {
      const mockFile = {
        size: 15 * 1024 * 1024 // 15MB
      };

      const result = fileValidator.validateFileSize(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'));
    });

    it('should reject empty file', () => {
      const mockFile = {
        size: 0
      };

      const result = fileValidator.validateFileSize(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Empty files'));
    });
  });

  describe('isExtensionAllowed', () => {
    it('should return true for allowed extensions', () => {
      expect(fileValidator.isExtensionAllowed('.png')).toBe(true);
      expect(fileValidator.isExtensionAllowed('.PDF')).toBe(true); // Case insensitive
    });

    it('should return false for disallowed extensions', () => {
      expect(fileValidator.isExtensionAllowed('.exe')).toBe(false);
      expect(fileValidator.isExtensionAllowed('.bat')).toBe(false);
    });
  });

  describe('getAllowedExtensions', () => {
    it('should return array of allowed extensions', () => {
      const extensions = fileValidator.getAllowedExtensions();
      
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions).toContain('.png');
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.txt');
    });
  });

  describe('getMaxFileSize', () => {
    it('should return maximum file size in bytes', () => {
      const maxSize = fileValidator.getMaxFileSize();
      
      expect(typeof maxSize).toBe('number');
      expect(maxSize).toBeGreaterThan(0);
    });
  });
});
