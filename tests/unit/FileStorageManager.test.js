const fs = require('fs').promises;
const path = require('path');
const FileStorageManager = require('../../src/main/storage/FileStorageManager');

// Mock the config module
jest.mock('../../src/main/config/AppConfig', () => ({
  getSecurityConfig: () => ({
    storage_path: './test-uploads',
    storage_permissions: '644'
  })
}));

describe('FileStorageManager', () => {
  let storageManager;
  const testDir = './test-uploads';

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }

    storageManager = new FileStorageManager();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
  });

  describe('storeFile', () => {
    it('should store file successfully', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      const result = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);

      expect(result.success).toBe(true);
      expect(result.storedFilename).toBeDefined();
      expect(result.fileSize).toBe(fileBuffer.length);
      expect(result.checksum).toBeDefined();
    });

    it('should generate secure filename', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      const result = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);

      expect(result.success).toBe(true);
      expect(result.storedFilename).toMatch(/^[a-f0-9-]{36}\.txt$/); // UUID + extension
    });

    it('should handle filename collision', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      // Store first file
      const result1 = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(result1.success).toBe(true);

      // Store second file with same name (should get different stored filename)
      const result2 = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(result2.success).toBe(true);
      expect(result2.storedFilename).not.toBe(result1.storedFilename);
    });
  });

  describe('retrieveFile', () => {
    it('should retrieve file successfully', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      // Store file first
      const storeResult = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(storeResult.success).toBe(true);

      // Retrieve file
      const retrieveResult = await storageManager.retrieveFile(storeResult.storedFilename, userId);

      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.fileBuffer).toEqual(fileBuffer);
      expect(retrieveResult.mimeType).toBe(mimeType);
    });

    it('should reject invalid filename', async () => {
      const result = await storageManager.retrieveFile('../../../etc/passwd', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid filename');
    });

    it('should handle non-existent file', async () => {
      const result = await storageManager.retrieveFile('non-existent-file.txt', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      // Store file first
      const storeResult = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(storeResult.success).toBe(true);

      // Delete file
      const deleteResult = await storageManager.deleteFile(storeResult.storedFilename, userId);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedFilename).toBe(storeResult.storedFilename);

      // Verify file is deleted
      const exists = await storageManager.fileExists(storeResult.storedFilename);
      expect(exists).toBe(false);
    });

    it('should reject invalid filename for deletion', async () => {
      const result = await storageManager.deleteFile('../../../etc/passwd', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid filename');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      // Store file first
      const storeResult = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(storeResult.success).toBe(true);

      // Check if file exists
      const exists = await storageManager.fileExists(storeResult.storedFilename);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await storageManager.fileExists('non-existent-file.txt');
      expect(exists).toBe(false);
    });

    it('should return false for invalid filename', async () => {
      const exists = await storageManager.fileExists('../../../etc/passwd');
      expect(exists).toBe(false);
    });
  });

  describe('isValidStoredFilename', () => {
    it('should accept valid filenames', () => {
      expect(storageManager.isValidStoredFilename('valid-file.txt')).toBe(true);
      expect(storageManager.isValidStoredFilename('12345678-1234-1234-1234-123456789012.pdf')).toBe(true);
    });

    it('should reject filenames with path traversal', () => {
      expect(storageManager.isValidStoredFilename('../../../etc/passwd')).toBe(false);
      expect(storageManager.isValidStoredFilename('file/with/slashes.txt')).toBe(false);
    });

    it('should reject filenames with dangerous characters', () => {
      expect(storageManager.isValidStoredFilename('file<with>dangerous.txt')).toBe(false);
      expect(storageManager.isValidStoredFilename('file|with|pipes.txt')).toBe(false);
    });

    it('should reject empty filename', () => {
      expect(storageManager.isValidStoredFilename('')).toBe(false);
      expect(storageManager.isValidStoredFilename('   ')).toBe(false);
    });

    it('should reject filename that is too long', () => {
      const longFilename = 'a'.repeat(256) + '.txt';
      expect(storageManager.isValidStoredFilename(longFilename)).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('should return file information', async () => {
      const fileBuffer = Buffer.from('test content');
      const originalFilename = 'test.txt';
      const mimeType = 'text/plain';
      const userId = 'user123';

      // Store file first
      const storeResult = await storageManager.storeFile(fileBuffer, originalFilename, mimeType, userId);
      expect(storeResult.success).toBe(true);

      // Get file info
      const infoResult = await storageManager.getFileInfo(storeResult.storedFilename);

      expect(infoResult.success).toBe(true);
      expect(infoResult.fileSize).toBe(fileBuffer.length);
      expect(infoResult.mimeType).toBe(mimeType);
    });

    it('should handle invalid filename', async () => {
      const result = await storageManager.getFileInfo('../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid filename');
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(storageManager.formatFileSize(0)).toBe('0 Bytes');
      expect(storageManager.formatFileSize(1024)).toBe('1 KB');
      expect(storageManager.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(storageManager.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });
});
