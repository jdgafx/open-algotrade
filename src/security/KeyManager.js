/**
 * Secure API Key Management System for Algorithmic Trading
 * Provides encrypted storage, rotation, and audit trail for trading API credentials
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class KeyManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Encryption settings
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,

      // Key rotation settings
      rotationInterval: config.rotationInterval || 30 * 24 * 60 * 60 * 1000, // 30 days
      rotationWarningDays: config.rotationWarningDays || 7,
      maxKeyAge: config.maxKeyAge || 90 * 24 * 60 * 60 * 1000, // 90 days

      // Access control
      maxFailedAttempts: config.maxFailedAttempts || 3,
      lockoutDuration: config.lockoutDuration || 30 * 60 * 1000, // 30 minutes

      // Audit settings
      auditRetentionDays: config.auditRetentionDays || 365,

      ...config
    };

    this.keyStore = new Map();
    this.accessLog = [];
    this.rotationSchedule = new Map();
    this.encryptionKey = null;

    this.initializeKeyManager();
  }

  /**
   * Initialize key manager
   */
  async initializeKeyManager() {
    try {
      // Initialize encryption key
      await this.initializeEncryptionKey();

      // Load existing keys
      await this.loadExistingKeys();

      // Set up rotation scheduler
      this.setupRotationScheduler();

      // Clean up expired access attempts
      this.setupCleanupScheduler();

      console.log('🔐 Key Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Key Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize encryption key
   */
  async initializeEncryptionKey() {
    try {
      const keyPath = path.join(__dirname, '../config/master.key');

      // Try to load existing key
      try {
        const keyData = await fs.readFile(keyPath, 'utf8');
        this.encryptionKey = Buffer.from(keyData, 'hex');
      } catch {
        // Generate new key if doesn't exist
        this.encryptionKey = crypto.randomBytes(32);
        await fs.writeFile(keyPath, this.encryptionKey.toString('hex'), { mode: 0o600 });
      }

      // Verify key strength
      if (this.encryptionKey.length !== 32) {
        throw new Error('Invalid encryption key length');
      }

    } catch (error) {
      throw new Error(`Failed to initialize encryption key: ${error.message}`);
    }
  }

  /**
   * Store API key securely
   */
  async storeApiKey(keyData) {
    const {
      exchange,
      apiKey,
      apiSecret,
      passphrase,
      permissions,
      userId,
      metadata
    } = keyData;

    const keyId = this.generateKeyId();
    const now = Date.now();

    try {
      // Validate input
      this.validateKeyData(keyData);

      // Create key entry
      const keyEntry = {
        id: keyId,
        exchange: exchange.toLowerCase(),
        createdAt: now,
        lastUsed: null,
        expiresAt: keyData.expiresAt || (now + this.config.maxKeyAge),
        permissions: permissions || ['read'],
        userId: userId,
        metadata: metadata || {},
        rotationHistory: [],
        status: 'active'
      };

      // Encrypt sensitive data
      const encryptedCredentials = await this.encryptCredentials({
        apiKey,
        apiSecret,
        passphrase
      });

      // Store encrypted credentials
      await this.storeEncryptedKey(keyId, encryptedCredentials);

      // Store metadata in memory
      this.keyStore.set(keyId, keyEntry);

      // Schedule rotation
      this.scheduleKeyRotation(keyId, keyEntry.expiresAt);

      // Log the operation
      await this.logKeyOperation('KEY_STORED', {
        keyId,
        exchange,
        userId,
        permissions
      });

      // Emit event
      this.emit('keyStored', { keyId, exchange, userId });

      console.log(`🔑 API key stored successfully for ${exchange}`);
      return keyEntry;

    } catch (error) {
      await this.logKeyOperation('KEY_STORE_FAILED', {
        exchange,
        userId,
        error: error.message
      });

      throw new Error(`Failed to store API key: ${error.message}`);
    }
  }

  /**
   * Retrieve API key securely
   */
  async retrieveApiKey(keyId, userId, reason = 'API_ACCESS') {
    try {
      // Validate access
      await this.validateKeyAccess(keyId, userId);

      // Get key metadata
      const keyMetadata = this.keyStore.get(keyId);
      if (!keyMetadata) {
        throw new Error('Key not found');
      }

      // Check if key is active
      if (keyMetadata.status !== 'active') {
        throw new Error(`Key is ${keyMetadata.status}`);
      }

      // Check if key has expired
      if (Date.now() > keyMetadata.expiresAt) {
        throw new Error('Key has expired');
      }

      // Retrieve encrypted credentials
      const encryptedCredentials = await this.retrieveEncryptedKey(keyId);

      // Decrypt credentials
      const credentials = await this.decryptCredentials(encryptedCredentials);

      // Update last used timestamp
      keyMetadata.lastUsed = Date.now();
      keyMetadata.lastUsedReason = reason;

      // Log the access
      await this.logKeyOperation('KEY_ACCESSED', {
        keyId,
        userId,
        reason,
        exchange: keyMetadata.exchange
      });

      // Emit event
      this.emit('keyAccessed', { keyId, userId, reason });

      return {
        ...keyMetadata,
        ...credentials
      };

    } catch (error) {
      await this.logKeyOperation('KEY_ACCESS_FAILED', {
        keyId,
        userId,
        error: error.message
      });

      throw new Error(`Failed to retrieve API key: ${error.message}`);
    }
  }

  /**
   * Rotate API key
   */
  async rotateApiKey(keyId, newCredentials, userId) {
    try {
      const keyMetadata = this.keyStore.get(keyId);
      if (!keyMetadata) {
        throw new Error('Key not found');
      }

      // Create rotation entry
      const rotationEntry = {
        timestamp: Date.now(),
        userId: userId,
        previousVersion: keyMetadata.version || 1,
        reason: 'SCHEDULED_ROTATION'
      };

      // Encrypt new credentials
      const newEncryptedCredentials = await this.encryptCredentials(newCredentials);

      // Backup old credentials
      const oldEncryptedCredentials = await this.retrieveEncryptedKey(keyId);
      await this.backupKeyCredentials(keyId, oldEncryptedCredentials);

      // Store new credentials
      await this.storeEncryptedKey(keyId, newEncryptedCredentials);

      // Update metadata
      keyMetadata.version = (keyMetadata.version || 1) + 1;
      keyMetadata.lastRotated = Date.now();
      keyMetadata.expiresAt = Date.now() + this.config.rotationInterval;
      keyMetadata.rotationHistory.push(rotationEntry);

      // Schedule next rotation
      this.scheduleKeyRotation(keyId, keyMetadata.expiresAt);

      // Log rotation
      await this.logKeyOperation('KEY_ROTATED', {
        keyId,
        userId,
        version: keyMetadata.version,
        exchange: keyMetadata.exchange
      });

      // Emit event
      this.emit('keyRotated', { keyId, userId, version: keyMetadata.version });

      console.log(`🔄 API key rotated successfully for ${keyMetadata.exchange}`);
      return keyMetadata;

    } catch (error) {
      await this.logKeyOperation('KEY_ROTATION_FAILED', {
        keyId,
        userId,
        error: error.message
      });

      throw new Error(`Failed to rotate API key: ${error.message}`);
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId, userId, reason = 'USER_REQUEST') {
    try {
      const keyMetadata = this.keyStore.get(keyId);
      if (!keyMetadata) {
        throw new Error('Key not found');
      }

      // Mark as revoked
      keyMetadata.status = 'revoked';
      keyMetadata.revokedAt = Date.now();
      keyMetadata.revokedBy = userId;
      keyMetadata.revocationReason = reason;

      // Cancel rotation schedule
      if (this.rotationSchedule.has(keyId)) {
        clearTimeout(this.rotationSchedule.get(keyId));
        this.rotationSchedule.delete(keyId);
      }

      // Log revocation
      await this.logKeyOperation('KEY_REVOKED', {
        keyId,
        userId,
        reason,
        exchange: keyMetadata.exchange
      });

      // Emit event
      this.emit('keyRevoked', { keyId, userId, reason });

      console.log(`🚫 API key revoked successfully for ${keyMetadata.exchange}`);
      return keyMetadata;

    } catch (error) {
      await this.logKeyOperation('KEY_REVOCATION_FAILED', {
        keyId,
        userId,
        error: error.message
      });

      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  /**
   * List user's API keys
   */
  async listUserKeys(userId) {
    const userKeys = [];

    for (const [keyId, metadata] of this.keyStore.entries()) {
      if (metadata.userId === userId) {
        const keyInfo = {
          id: keyId,
          exchange: metadata.exchange,
          createdAt: metadata.createdAt,
          lastUsed: metadata.lastUsed,
          expiresAt: metadata.expiresAt,
          status: metadata.status,
          permissions: metadata.permissions,
          lastRotated: metadata.lastRotated,
          version: metadata.version || 1
        };

        // Add expiration warning
        const daysUntilExpiry = Math.floor((metadata.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysUntilExpiry <= this.config.rotationWarningDays) {
          keyInfo.expirationWarning = `Expires in ${daysUntilExpiry} days`;
        }

        userKeys.push(keyInfo);
      }
    }

    return userKeys;
  }

  /**
   * Get key usage statistics
   */
  async getKeyStatistics(userId = null) {
    const stats = {
      totalKeys: 0,
      activeKeys: 0,
      expiredKeys: 0,
      revokedKeys: 0,
      keysExpiringSoon: 0,
      keysByExchange: {},
      averageKeyAge: 0,
      lastAccessed: null
    };

    const now = Date.now();
    let totalAge = 0;
    const lastAccessedTimes = [];

    for (const [keyId, metadata] of this.keyStore.entries()) {
      // Filter by user if specified
      if (userId && metadata.userId !== userId) {
        continue;
      }

      stats.totalKeys++;

      // Count by status
      switch (metadata.status) {
        case 'active':
          stats.activeKeys++;
          break;
        case 'expired':
          stats.expiredKeys++;
          break;
        case 'revoked':
          stats.revokedKeys++;
          break;
      }

      // Count by exchange
      stats.keysByExchange[metadata.exchange] = (stats.keysByExchange[metadata.exchange] || 0) + 1;

      // Check expiration
      const daysUntilExpiry = Math.floor((metadata.expiresAt - now) / (24 * 60 * 60 * 1000));
      if (daysUntilExpiry <= this.config.rotationWarningDays && metadata.status === 'active') {
        stats.keysExpiringSoon++;
      }

      // Calculate age
      const keyAge = now - metadata.createdAt;
      totalAge += keyAge;

      // Track last accessed
      if (metadata.lastUsed) {
        lastAccessedTimes.push(metadata.lastUsed);
      }
    }

    stats.averageKeyAge = stats.totalKeys > 0 ? totalAge / stats.totalKeys : 0;
    stats.lastAccessed = lastAccessedTimes.length > 0 ? Math.max(...lastAccessedTimes) : null;

    return stats;
  }

  /**
   * Encrypt credentials
   */
  async encryptCredentials(credentials) {
    try {
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);

      const key = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        this.config.keyDerivationIterations,
        32,
        'sha256'
      );

      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key);
      cipher.setAAD(Buffer.from('api-credentials'));

      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.config.encryptionAlgorithm,
        iterations: this.config.keyDerivationIterations
      };

    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt credentials
   */
  async decryptCredentials(encryptedData) {
    try {
      const { encrypted, salt, iv, tag, algorithm, iterations } = encryptedData;

      const key = crypto.pbkdf2Sync(
        this.encryptionKey,
        Buffer.from(salt, 'hex'),
        iterations,
        32,
        'sha256'
      );

      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAAD(Buffer.from('api-credentials'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);

    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Validate key data
   */
  validateKeyData(keyData) {
    const required = ['exchange', 'apiKey', 'apiSecret'];

    for (const field of required) {
      if (!keyData[field] || typeof keyData[field] !== 'string' || keyData[field].length < 10) {
        throw new Error(`Invalid ${field}: must be a non-empty string with at least 10 characters`);
      }
    }

    // Validate exchange format
    if (!/^[a-z0-9-]+$/i.test(keyData.exchange)) {
      throw new Error('Invalid exchange format');
    }

    // Validate API key format
    if (!/^[a-zA-Z0-9-_]+$/.test(keyData.apiKey)) {
      throw new Error('Invalid API key format');
    }

    // Validate permissions
    if (keyData.permissions) {
      const validPermissions = ['read', 'write', 'trade', 'withdraw'];
      for (const permission of keyData.permissions) {
        if (!validPermissions.includes(permission)) {
          throw new Error(`Invalid permission: ${permission}`);
        }
      }
    }
  }

  /**
   * Validate key access
   */
  async validateKeyAccess(keyId, userId) {
    // Check failed attempts
    const attemptKey = `${keyId}:${userId}`;
    const now = Date.now();

    if (!this.failedAttempts) {
      this.failedAttempts = new Map();
    }

    const attempts = this.failedAttempts.get(attemptKey) || [];
    const recentAttempts = attempts.filter(time => now - time < this.config.lockoutDuration);

    if (recentAttempts.length >= this.config.maxFailedAttempts) {
      throw new Error('Access temporarily locked due to too many failed attempts');
    }

    // Store attempt
    recentAttempts.push(now);
    this.failedAttempts.set(attemptKey, recentAttempts);
  }

  /**
   * Generate unique key ID
   */
  generateKeyId() {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Setup rotation scheduler
   */
  setupRotationScheduler() {
    // Check for keys needing rotation every hour
    setInterval(() => {
      this.checkRotations();
    }, 60 * 60 * 1000);
  }

  /**
   * Check and execute scheduled rotations
   */
  async checkRotations() {
    const now = Date.now();

    for (const [keyId, metadata] of this.keyStore.entries()) {
      if (metadata.status === 'active' && metadata.expiresAt <= now) {
        // Emit rotation needed event
        this.emit('rotationNeeded', {
          keyId,
          exchange: metadata.exchange,
          userId: metadata.userId
        });
      }

      // Check for expiration warnings
      const warningTime = metadata.expiresAt - (this.config.rotationWarningDays * 24 * 60 * 60 * 1000);
      if (metadata.status === 'active' && warningTime <= now && warningTime > (now - 60 * 60 * 1000)) {
        // Emit warning event
        this.emit('expirationWarning', {
          keyId,
          exchange: metadata.exchange,
          userId: metadata.userId,
          daysUntilExpiry: Math.ceil((metadata.expiresAt - now) / (24 * 60 * 60 * 1000))
        });
      }
    }
  }

  /**
   * Schedule key rotation
   */
  scheduleKeyRotation(keyId, expiresAt) {
    if (this.rotationSchedule.has(keyId)) {
      clearTimeout(this.rotationSchedule.get(keyId));
    }

    const timeout = expiresAt - Date.now();
    if (timeout > 0) {
      const timer = setTimeout(() => {
        this.emit('rotationNeeded', { keyId });
      }, timeout);

      this.rotationSchedule.set(keyId, timer);
    }
  }

  /**
   * Store encrypted key
   */
  async storeEncryptedKey(keyId, encryptedData) {
    const keyDir = path.join(__dirname, '../keys');
    await fs.mkdir(keyDir, { recursive: true });

    const keyFile = path.join(keyDir, `${keyId}.encrypted`);
    await fs.writeFile(keyFile, JSON.stringify(encryptedData), { mode: 0o600 });
  }

  /**
   * Retrieve encrypted key
   */
  async retrieveEncryptedKey(keyId) {
    const keyFile = path.join(__dirname, '../keys', `${keyId}.encrypted`);

    try {
      const keyData = await fs.readFile(keyFile, 'utf8');
      return JSON.parse(keyData);
    } catch (error) {
      throw new Error('Key file not found or corrupted');
    }
  }

  /**
   * Backup key credentials
   */
  async backupKeyCredentials(keyId, encryptedData) {
    const backupDir = path.join(__dirname, '../backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = Date.now();
    const backupFile = path.join(backupDir, `${keyId}_backup_${timestamp}.encrypted`);
    await fs.writeFile(backupFile, JSON.stringify(encryptedData), { mode: 0o600 });

    // Clean up old backups (keep only last 5)
    await this.cleanupOldBackups(keyId, backupDir, 5);
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(keyId, backupDir, keepCount) {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(f => f.startsWith(`${keyId}_backup_`) && f.endsWith('.encrypted'))
        .sort()
        .reverse();

      const filesToDelete = backupFiles.slice(keepCount);

      for (const file of filesToDelete) {
        await fs.unlink(path.join(backupDir, file));
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Log key operation
   */
  async logKeyOperation(operation, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      data: this.sanitizeLogData(data),
      source: this.getSourceInfo()
    };

    this.accessLog.push(logEntry);

    // Keep log in memory manageable
    if (this.accessLog.length > 10000) {
      this.accessLog = this.accessLog.slice(-5000);
    }

    // Persist to file
    try {
      const logFile = path.join(__dirname, '../logs/key_access.log');
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to log key operation:', error);
    }
  }

  /**
   * Sanitize log data
   */
  sanitizeLogData(data) {
    const sanitized = { ...data };

    // Remove sensitive fields
    const sensitiveFields = ['apiKey', 'apiSecret', 'passphrase', 'password'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get source information
   */
  getSourceInfo() {
    return {
      hostname: require('os').hostname(),
      pid: process.pid,
      service: 'key-manager'
    };
  }

  /**
   * Load existing keys from storage
   */
  async loadExistingKeys() {
    try {
      const metadataFile = path.join(__dirname, '../config/keys_metadata.json');

      try {
        const metadataData = await fs.readFile(metadataFile, 'utf8');
        const metadata = JSON.parse(metadataData);

        for (const [keyId, keyMetadata] of Object.entries(metadata)) {
          this.keyStore.set(keyId, keyMetadata);

          // Reschedule rotation
          if (keyMetadata.status === 'active') {
            this.scheduleKeyRotation(keyId, keyMetadata.expiresAt);
          }
        }

        console.log(`📂 Loaded ${this.keyStore.size} existing keys`);
      } catch {
        console.log('📂 No existing keys found, starting fresh');
      }

    } catch (error) {
      console.error('Failed to load existing keys:', error);
    }
  }

  /**
   * Save key metadata
   */
  async saveKeyMetadata() {
    try {
      const configDir = path.join(__dirname, '../config');
      await fs.mkdir(configDir, { recursive: true });

      const metadataFile = path.join(configDir, 'keys_metadata.json');
      const metadata = Object.fromEntries(this.keyStore);

      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Failed to save key metadata:', error);
    }
  }

  /**
   * Setup cleanup scheduler
   */
  setupCleanupScheduler() {
    // Clean up old data daily
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    const now = Date.now();
    const cutoff = now - (this.config.auditRetentionDays * 24 * 60 * 60 * 1000);

    // Clean access log
    this.accessLog = this.accessLog.filter(entry =>
      new Date(entry.timestamp).getTime() > cutoff
    );

    // Clean failed attempts
    if (this.failedAttempts) {
      for (const [key, attempts] of this.failedAttempts.entries()) {
        const recentAttempts = attempts.filter(time => time > cutoff);
        if (recentAttempts.length === 0) {
          this.failedAttempts.delete(key);
        } else {
          this.failedAttempts.set(key, recentAttempts);
        }
      }
    }
  }
}

module.exports = KeyManager;