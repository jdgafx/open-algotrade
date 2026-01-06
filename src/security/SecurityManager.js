/**
 * Comprehensive Security Manager for Algorithmic Trading Platform
 * Implements enterprise-grade security with threat detection, monitoring, and incident response
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class SecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Security thresholds
      maxFailedAttempts: config.maxFailedAttempts || 5,
      lockoutDuration: config.lockoutDuration || 15 * 60 * 1000, // 15 minutes
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
      auditRetentionDays: config.auditRetentionDays || 90,

      // Encryption settings
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,

      // Rate limiting
      rateLimitWindow: 60000, // 1 minute
      rateLimitMaxRequests: 100,

      ...config
    };

    // Security state
    this.activeSessions = new Map();
    this.failedAttempts = new Map();
    this.rateLimitStore = new Map();
    this.auditLog = [];
    this.securityMetrics = {
      totalRequests: 0,
      blockedRequests: 0,
      securityEvents: 0,
      lastScan: null
    };

    // Initialize security components
    this.initializeSecurityComponents();
  }

  /**
   * Initialize all security subsystems
   */
  async initializeSecurityComponents() {
    try {
      await this.initializeAuditLogger();
      await this.initializeThreatDetection();
      await this.initializeKeyManager();
      await this.loadSecurityPolicies();

      this.logSecurityEvent('SECURITY_MANAGER_INITIALIZED', {
        timestamp: new Date().toISOString(),
        config: this.sanitizeConfig()
      });

      console.log('✅ Security Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Security Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize Audit Logger
   */
  async initializeAuditLogger() {
    this.auditLogger = {
      log: async (event, data = {}) => {
        const auditEntry = {
          id: this.generateSecureId(),
          timestamp: new Date().toISOString(),
          event: event,
          data: this.sanitizeData(data),
          severity: this.getEventSeverity(event),
          source: this.getSourceInfo()
        };

        this.auditLog.push(auditEntry);
        await this.persistAuditEntry(auditEntry);
        await this.checkEventTriggers(auditEntry);
      },

      query: async (filters = {}) => {
        return this.queryAuditLog(filters);
      },

      export: async (format = 'json') => {
        return this.exportAuditLog(format);
      }
    };
  }

  /**
   * Initialize Threat Detection System
   */
  async initializeThreatDetection() {
    this.threatDetector = {
      // Anomaly detection
      detectAnomalies: (request) => {
        return this.detectRequestAnomalies(request);
      },

      // Pattern recognition
      analyzePatterns: (requests) => {
        return this.analyzeRequestPatterns(requests);
      },

      // Attack detection
      detectAttacks: (request) => {
        return this.detectSecurityAttacks(request);
      },

      // Behavioral analysis
      analyzeBehavior: (userId, actions) => {
        return this.analyzeUserBehavior(userId, actions);
      }
    };
  }

  /**
   * Initialize Secure Key Manager
   */
  async initializeKeyManager() {
    this.keyManager = {
      // API key management
      storeApiKey: async (exchange, keyData) => {
        return await this.securelyStoreApiKey(exchange, keyData);
      },

      retrieveApiKey: async (exchange, keyId) => {
        return await this.securelyRetrieveApiKey(exchange, keyId);
      },

      rotateApiKey: async (exchange, keyId) => {
        return await this.rotateApiKey(exchange, keyId);
      },

      // Encryption/Decryption
      encrypt: async (data, key) => {
        return await this.encryptData(data, key);
      },

      decrypt: async (encryptedData, key) => {
        return await this.decryptData(encryptedData, key);
      }
    };
  }

  /**
   * Main security validation for requests
   */
  async validateRequest(request) {
    const requestId = this.generateSecureId();
    const startTime = Date.now();

    try {
      this.securityMetrics.totalRequests++;

      // 1. Rate limiting check
      if (!this.checkRateLimit(request)) {
        await this.auditLogger.log('RATE_LIMIT_EXCEEDED', {
          requestId,
          ip: request.ip,
          endpoint: request.path
        });
        this.securityMetrics.blockedRequests++;
        return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
      }

      // 2. Authentication check
      const authResult = await this.validateAuthentication(request);
      if (!authResult.valid) {
        await this.handleFailedAuthentication(request, authResult.reason);
        return { allowed: false, reason: authResult.reason };
      }

      // 3. Threat detection
      const threats = await this.threatDetector.detectAttacks(request);
      if (threats.length > 0) {
        await this.handleDetectedThreats(request, threats);
        return { allowed: false, reason: 'THREAT_DETECTED', threats };
      }

      // 4. Anomaly detection
      const anomalies = await this.threatDetector.detectAnomalies(request);
      if (anomalies.length > 0) {
        await this.handleDetectedAnomalies(request, anomalies);
        // Anomalies might not block, but require monitoring
      }

      // 5. Session validation
      if (request.session) {
        const sessionValid = await this.validateSession(request.session);
        if (!sessionValid) {
          return { allowed: false, reason: 'INVALID_SESSION' };
        }
      }

      // Request passed all security checks
      const validationTime = Date.now() - startTime;
      await this.auditLogger.log('REQUEST_VALIDATED', {
        requestId,
        validationTime,
        userId: request.user?.id,
        endpoint: request.path
      });

      return {
        allowed: true,
        requestId,
        validationTime
      };

    } catch (error) {
      await this.auditLogger.log('VALIDATION_ERROR', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      return {
        allowed: false,
        reason: 'VALIDATION_ERROR',
        error: error.message
      };
    }
  }

  /**
   * Rate limiting implementation
   */
  checkRateLimit(request) {
    const key = `${request.ip}:${request.path}`;
    const now = Date.now();
    const window = this.config.rateLimitWindow;

    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, []);
    }

    const requests = this.rateLimitStore.get(key);

    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < window);
    this.rateLimitStore.set(key, validRequests);

    // Check if under limit
    if (validRequests.length >= this.config.rateLimitMaxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    return true;
  }

  /**
   * Authentication validation
   */
  async validateAuthentication(request) {
    // Check API key authentication
    if (request.headers['x-api-key']) {
      return await this.validateApiKey(request.headers['x-api-key']);
    }

    // Check JWT token
    if (request.headers.authorization?.startsWith('Bearer ')) {
      return await this.validateJwtToken(request.headers.authorization.slice(7));
    }

    // Check session authentication
    if (request.session?.userId) {
      return await this.validateSession(request.session);
    }

    return { valid: false, reason: 'NO_AUTHENTICATION' };
  }

  /**
   * API Key validation
   */
  async validateApiKey(apiKey) {
    try {
      // Hash the provided key for comparison
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Check against stored keys (implementation depends on your key storage)
      const storedKey = await this.getStoredApiKey(hashedKey);

      if (!storedKey) {
        return { valid: false, reason: 'INVALID_API_KEY' };
      }

      if (storedKey.expiresAt && storedKey.expiresAt < Date.now()) {
        return { valid: false, reason: 'API_KEY_EXPIRED' };
      }

      if (!storedKey.active) {
        return { valid: false, reason: 'API_KEY_INACTIVE' };
      }

      return {
        valid: true,
        userId: storedKey.userId,
        permissions: storedKey.permissions
      };

    } catch (error) {
      return { valid: false, reason: 'API_KEY_VALIDATION_ERROR' };
    }
  }

  /**
   * JWT Token validation
   */
  async validateJwtToken(token) {
    try {
      // Implementation would depend on your JWT library
      // This is a placeholder for JWT validation logic
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      return {
        valid: true,
        userId: decoded.userId,
        permissions: decoded.permissions
      };

    } catch (error) {
      return { valid: false, reason: 'INVALID_TOKEN' };
    }
  }

  /**
   * Session validation
   */
  async validateSession(session) {
    const sessionId = session.id;

    if (!this.activeSessions.has(sessionId)) {
      return false;
    }

    const activeSession = this.activeSessions.get(sessionId);

    // Check session timeout
    if (Date.now() - activeSession.lastAccess > this.config.sessionTimeout) {
      this.activeSessions.delete(sessionId);
      return false;
    }

    // Update last access time
    activeSession.lastAccess = Date.now();
    return true;
  }

  /**
   * Security attack detection
   */
  async detectSecurityAttacks(request) {
    const threats = [];

    // SQL Injection detection
    if (this.detectSqlInjection(request)) {
      threats.push({ type: 'SQL_INJECTION', severity: 'HIGH' });
    }

    // XSS detection
    if (this.detectXSS(request)) {
      threats.push({ type: 'XSS', severity: 'MEDIUM' });
    }

    // Command injection detection
    if (this.detectCommandInjection(request)) {
      threats.push({ type: 'COMMAND_INJECTION', severity: 'HIGH' });
    }

    // Path traversal detection
    if (this.detectPathTraversal(request)) {
      threats.push({ type: 'PATH_TRAVERSAL', severity: 'HIGH' });
    }

    // CSRF detection (for state-changing requests)
    if (this.detectCSRF(request)) {
      threats.push({ type: 'CSRF', severity: 'MEDIUM' });
    }

    return threats;
  }

  /**
   * SQL Injection detection
   */
  detectSqlInjection(request) {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|;|\/\*|\*\/|@@)/g,
      /(\b(or|and)\s+\d+\s*=\s*\d+)/gi,
      /(\b(or|and)\s+['"]?['"]?\s*=\s*['"]?['"]?)/gi
    ];

    const checkValue = (value) => {
      if (typeof value !== 'string') return false;
      return sqlPatterns.some(pattern => pattern.test(value));
    };

    // Check query parameters
    for (const [key, value] of Object.entries(request.query || {})) {
      if (checkValue(value)) return true;
    }

    // Check body
    if (request.body) {
      for (const [key, value] of Object.entries(request.body)) {
        if (checkValue(value)) return true;
      }
    }

    // Check headers
    for (const [key, value] of Object.entries(request.headers)) {
      if (checkValue(value)) return true;
    }

    return false;
  }

  /**
   * XSS detection
   */
  detectXSS(request) {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi
    ];

    const checkValue = (value) => {
      if (typeof value !== 'string') return false;
      return xssPatterns.some(pattern => pattern.test(value));
    };

    // Check request parameters and body
    const allParams = { ...request.query, ...request.body };
    for (const [key, value] of Object.entries(allParams)) {
      if (checkValue(value)) return true;
    }

    return false;
  }

  /**
   * Command injection detection
   */
  detectCommandInjection(request) {
    const commandPatterns = [
      /(\||&|;|\$\(|\`|>|<)/g,
      /(rm|mv|cp|cat|ls|ps|kill|chmod|chown|whoami|id|uname)/gi,
      /(nc|netcat|wget|curl|ssh|ftp|telnet)/gi,
      /(python|perl|ruby|bash|sh|cmd|powershell)/gi
    ];

    const checkValue = (value) => {
      if (typeof value !== 'string') return false;
      return commandPatterns.some(pattern => pattern.test(value));
    };

    const allParams = { ...request.query, ...request.body };
    for (const [key, value] of Object.entries(allParams)) {
      if (checkValue(value)) return true;
    }

    return false;
  }

  /**
   * Path traversal detection
   */
  detectPathTraversal(request) {
    const pathTraversalPatterns = [
      /\.\.[\/\\]/g,
      /\.\.\/\.\.\//g,
      /%2e%2e[\/\\]/gi,
      /%2e%2e%2f/gi
    ];

    const checkValue = (value) => {
      if (typeof value !== 'string') return false;
      return pathTraversalPatterns.some(pattern => pattern.test(value));
    };

    // Check path parameters and file-related inputs
    const allParams = { ...request.query, ...request.body };
    for (const [key, value] of Object.entries(allParams)) {
      if (key.toLowerCase().includes('file') || key.toLowerCase().includes('path')) {
        if (checkValue(value)) return true;
      }
    }

    return false;
  }

  /**
   * CSRF detection (simplified)
   */
  detectCSRF(request) {
    // Only check state-changing methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      return false;
    }

    // Skip if request has valid CSRF token
    if (request.headers['x-csrf-token'] || request.body._csrf) {
      return false;
    }

    // Check if request has referer header
    const referer = request.headers.referer;
    const origin = request.headers.origin;

    if (!referer && !origin) {
      return true; // Suspicious: no referer or origin for state-changing request
    }

    return false;
  }

  /**
   * Request anomaly detection
   */
  async detectRequestAnomalies(request) {
    const anomalies = [];

    // Check for unusual request size
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 1024 * 1024) { // 1MB
      anomalies.push({ type: 'LARGE_REQUEST', size: requestSize });
    }

    // Check for unusual user agent
    const userAgent = request.headers['user-agent'];
    if (!userAgent || userAgent.length < 10) {
      anomalies.push({ type: 'SUSPICIOUS_USER_AGENT', userAgent });
    }

    // Check for unusual timing patterns
    const clientIp = request.ip;
    const now = Date.now();

    if (!this.requestTiming) {
      this.requestTiming = new Map();
    }

    const ipRequests = this.requestTiming.get(clientIp) || [];
    ipRequests.push(now);

    // Remove old requests (last hour)
    const recentRequests = ipRequests.filter(time => now - time < 3600000);
    this.requestTiming.set(clientIp, recentRequests);

    // Check for excessive request rate
    if (recentRequests.length > 1000) { // 1000 requests per hour
      anomalies.push({ type: 'HIGH_REQUEST_RATE', count: recentRequests.length });
    }

    return anomalies;
  }

  /**
   * Handle failed authentication attempts
   */
  async handleFailedAuthentication(request, reason) {
    const key = `${request.ip}:${request.user?.id || 'anonymous'}`;
    const now = Date.now();

    if (!this.failedAttempts.has(key)) {
      this.failedAttempts.set(key, []);
    }

    const attempts = this.failedAttempts.get(key);
    attempts.push({ timestamp: now, reason });

    // Remove old attempts (outside lockout window)
    const validAttempts = attempts.filter(
      attempt => now - attempt.timestamp < this.config.lockoutDuration
    );
    this.failedAttempts.set(key, validAttempts);

    // Check if should lockout
    if (validAttempts.length >= this.config.maxFailedAttempts) {
      await this.handleLockout(key, validAttempts);
    }

    await this.auditLogger.log('AUTHENTICATION_FAILED', {
      ip: request.ip,
      reason,
      attemptCount: validAttempts.length,
      userAgent: request.headers['user-agent']
    });
  }

  /**
   * Handle account lockout
   */
  async handleLockout(key, attempts) {
    const lockoutExpiry = Date.now() + this.config.lockoutDuration;

    await this.auditLogger.log('ACCOUNT_LOCKED', {
      key,
      attempts: attempts.length,
      lockoutExpiry: new Date(lockoutExpiry).toISOString()
    });

    // Emit lockout event for monitoring
    this.emit('security_event', {
      type: 'ACCOUNT_LOCKED',
      key,
      attempts: attempts.length
    });
  }

  /**
   * Handle detected threats
   */
  async handleDetectedThreats(request, threats) {
    this.securityMetrics.securityEvents++;

    await this.auditLogger.log('THREATS_DETECTED', {
      ip: request.ip,
      threats,
      userAgent: request.headers['user-agent'],
      endpoint: request.path
    });

    // Block the IP temporarily for high-severity threats
    const highSeverityThreats = threats.filter(t => t.severity === 'HIGH');
    if (highSeverityThreats.length > 0) {
      await this.temporaryBlockIP(request.ip, 300000); // 5 minutes
    }

    this.emit('security_event', {
      type: 'THREATS_DETECTED',
      ip: request.ip,
      threats
    });
  }

  /**
   * Handle detected anomalies
   */
  async handleDetectedAnomalies(request, anomalies) {
    await this.auditLogger.log('ANOMALIES_DETECTED', {
      ip: request.ip,
      anomalies,
      endpoint: request.path
    });

    this.emit('security_event', {
      type: 'ANOMALIES_DETECTED',
      ip: request.ip,
      anomalies
    });
  }

  /**
   * Temporary IP blocking
   */
  async temporaryBlockIP(ip, duration = 300000) {
    const blockedUntil = Date.now() + duration;

    if (!this.blockedIPs) {
      this.blockedIPs = new Map();
    }

    this.blockedIPs.set(ip, blockedUntil);

    await this.auditLogger.log('IP_BLOCKED', {
      ip,
      duration,
      blockedUntil: new Date(blockedUntil).toISOString()
    });
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip) {
    if (!this.blockedIPs || !this.blockedIPs.has(ip)) {
      return false;
    }

    const blockedUntil = this.blockedIPs.get(ip);
    if (Date.now() > blockedUntil) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Data encryption
   */
  async encryptData(data, encryptionKey) {
    try {
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key);

      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Data decryption
   */
  async decryptData(encryptedData, encryptionKey) {
    try {
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipher(this.config.encryptionAlgorithm, key);

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate secure random ID
   */
  generateSecureId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sanitize configuration for logging
   */
  sanitizeConfig() {
    const sanitized = { ...this.config };
    delete sanitized.encryptionKey;
    delete sanitized.jwtSecret;
    return sanitized;
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeData(data) {
    const sensitiveKeys = ['password', 'apiKey', 'secret', 'token', 'key'];
    const sanitized = { ...data };

    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get event severity
   */
  getEventSeverity(event) {
    const highSeverityEvents = [
      'THREATS_DETECTED',
      'ACCOUNT_LOCKED',
      'IP_BLOCKED',
      'UNAUTHORIZED_ACCESS'
    ];

    const mediumSeverityEvents = [
      'ANOMALIES_DETECTED',
      'AUTHENTICATION_FAILED',
      'RATE_LIMIT_EXCEEDED'
    ];

    if (highSeverityEvents.includes(event)) return 'HIGH';
    if (mediumSeverityEvents.includes(event)) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get source information for audit entries
   */
  getSourceInfo() {
    return {
      hostname: require('os').hostname(),
      pid: process.pid,
      timestamp: Date.now()
    };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event, data) {
    await this.auditLogger.log(event, data);
  }

  /**
   * Persist audit entry
   */
  async persistAuditEntry(entry) {
    try {
      const auditFile = path.join(__dirname, '../logs/audit.log');
      await fs.appendFile(auditFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Failed to persist audit entry:', error);
    }
  }

  /**
   * Check event triggers and automated responses
   */
  async checkEventTriggers(entry) {
    // Automated responses based on events
    if (entry.event === 'THREATS_DETECTED' && entry.severity === 'HIGH') {
      // Trigger automated response
      this.triggerAutomatedResponse(entry);
    }

    if (entry.event === 'ACCOUNT_LOCKED') {
      // Notify security team
      this.notifySecurityTeam(entry);
    }
  }

  /**
   * Trigger automated security response
   */
  triggerAutomatedResponse(entry) {
    // Implementation for automated security responses
    this.emit('automated_response', entry);
  }

  /**
   * Notify security team
   */
  notifySecurityTeam(entry) {
    // Implementation for security team notifications
    this.emit('security_alert', entry);
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics() {
    return {
      ...this.securityMetrics,
      activeSessions: this.activeSessions.size,
      blockedIPs: this.blockedIPs ? this.blockedIPs.size : 0,
      failedAttempts: Array.from(this.failedAttempts.values())
        .reduce((sum, attempts) => sum + attempts.length, 0)
    };
  }

  /**
   * Perform security health check
   */
  async performSecurityHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'HEALTHY',
      checks: {}
    };

    try {
      // Check audit logging
      healthCheck.checks.auditLogging = this.auditLog.length > 0;

      // Check rate limiting
      healthCheck.checks.rateLimiting = this.rateLimitStore.size >= 0;

      // Check session management
      healthCheck.checks.sessionManagement = this.activeSessions !== null;

      // Check threat detection
      healthCheck.checks.threatDetection = this.threatDetector !== null;

      // Check key management
      healthCheck.checks.keyManagement = this.keyManager !== null;

      // Overall status
      const allChecksPass = Object.values(healthCheck.checks).every(check => check === true);
      healthCheck.status = allChecksPass ? 'HEALTHY' : 'DEGRADED';

    } catch (error) {
      healthCheck.status = 'ERROR';
      healthCheck.error = error.message;
    }

    return healthCheck;
  }
}

module.exports = SecurityManager;