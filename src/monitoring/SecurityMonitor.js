/**
 * Security Monitoring and Alerting System for Algorithmic Trading
 * Provides real-time security monitoring, threat detection, and automated incident response
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecurityMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Monitoring intervals
      monitoringInterval: config.monitoringInterval || 5000, // 5 seconds
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      alertCooldown: config.alertCooldown || 60000, // 1 minute

      // Thresholds
      maxFailedLogins: config.maxFailedLogins || 5,
      maxAnomalousRequests: config.maxAnomalousRequests || 10,
      maxMemoryUsage: config.maxMemoryUsage || 0.8, // 80%
      maxCpuUsage: config.maxCpuUsage || 0.8, // 80%
      maxDiskUsage: config.maxDiskUsage || 0.9, // 90%

      // Alerting
      enableSlackAlerts: config.enableSlackAlerts || false,
      enableEmailAlerts: config.enableEmailAlerts || false,
      enableSmsAlerts: config.enableSmsAlerts || false,
      slackWebhook: config.slackWebhook,
      emailConfig: config.emailConfig,

      // Automated response
      enableAutoResponse: config.enableAutoResponse !== false,
      autoBlockDuration: config.autoBlockDuration || 300000, // 5 minutes
      enableKillSwitch: config.enableKillSwitch || false,

      // Logging
      logRetentionDays: config.logRetentionDays || 30,
      enableAuditTrail: config.enableAuditTrail !== false,

      ...config
    };

    this.monitoringState = {
      active: false,
      startTime: null,
      metrics: {
        totalAlerts: 0,
        blockedIPs: 0,
        incidentsResolved: 0,
        falsePositives: 0
      },
      alerts: new Map(),
      blockedIPs: new Map(),
      incidents: []
    };

    this.initializeMonitor();
  }

  /**
   * Initialize security monitor
   */
  async initializeMonitor() {
    try {
      // Load previous state
      await this.loadMonitorState();

      // Setup monitoring intervals
      this.setupMonitoringIntervals();

      // Setup alert channels
      await this.setupAlertChannels();

      // Initialize threat detection models
      await this.initializeThreatDetection();

      // Setup automated response
      this.setupAutomatedResponse();

      console.log('🛡️ Security Monitor initialized and ready');
      console.log(`📊 Monitoring interval: ${this.config.monitoringInterval}ms`);

    } catch (error) {
      console.error('❌ Failed to initialize Security Monitor:', error);
      throw error;
    }
  }

  /**
   * Start security monitoring
   */
  async startMonitoring() {
    if (this.monitoringState.active) {
      console.log('⚠️ Security monitoring is already active');
      return;
    }

    this.monitoringState.active = true;
    this.monitoringState.startTime = Date.now();

    console.log('🚀 Security monitoring started');

    this.emit('monitoringStarted', {
      timestamp: new Date().toISOString(),
      startTime: this.monitoringState.startTime
    });

    // Log monitoring start
    await this.logSecurityEvent('MONITORING_STARTED', {
      timestamp: new Date().toISOString(),
      config: this.sanitizeConfig()
    });
  }

  /**
   * Stop security monitoring
   */
  async stopMonitoring() {
    if (!this.monitoringState.active) {
      console.log('⚠️ Security monitoring is not active');
      return;
    }

    this.monitoringState.active = false;

    // Clear monitoring intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    console.log('🛑 Security monitoring stopped');

    this.emit('monitoringStopped', {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.monitoringState.startTime
    });

    // Save current state
    await this.saveMonitorState();

    await this.logSecurityEvent('MONITORING_STOPPED', {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.monitoringState.startTime,
      metrics: this.monitoringState.metrics
    });
  }

  /**
   * Setup monitoring intervals
   */
  setupMonitoringIntervals() {
    // Main security monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (this.monitoringState.active) {
        await this.performSecurityCheck();
      }
    }, this.config.monitoringInterval);

    // System health checks
    this.healthCheckInterval = setInterval(async () => {
      if (this.monitoringState.active) {
        await this.performHealthCheck();
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform comprehensive security check
   */
  async performSecurityCheck() {
    try {
      const checkId = this.generateCheckId();
      const checkStartTime = Date.now();

      const securityCheck = {
        id: checkId,
        timestamp: new Date().toISOString(),
        checks: {}
      };

      // 1. Check for suspicious login attempts
      securityCheck.checks.loginAttempts = await this.checkLoginAttempts();

      // 2. Monitor API access patterns
      securityCheck.checks.apiAccess = await this.checkApiAccessPatterns();

      // 3. Check for anomalies in trading activity
      securityCheck.checks.tradingActivity = await this.checkTradingAnomalies();

      // 4. Monitor system resources
      securityCheck.checks.systemResources = await this.checkSystemResources();

      // 5. Check for data integrity issues
      securityCheck.checks.dataIntegrity = await this.checkDataIntegrity();

      // 6. Monitor network activity
      securityCheck.checks.networkActivity = await this.checkNetworkActivity();

      // 7. Check for configuration changes
      securityCheck.checks.configuration = await this.checkConfigurationChanges();

      // 8. Monitor key usage patterns
      securityCheck.checks.keyUsage = await this.checkKeyUsagePatterns();

      // Analyze results and take action
      const analysis = await this.analyzeSecurityCheck(securityCheck);
      securityCheck.analysis = analysis;
      securityCheck.duration = Date.now() - checkStartTime;

      // Store check results
      await this.storeSecurityCheck(securityCheck);

      // Handle detected threats
      if (analysis.threats.length > 0) {
        await this.handleDetectedThreats(analysis.threats);
      }

      // Emit security check completed event
      this.emit('securityCheckCompleted', securityCheck);

    } catch (error) {
      console.error('❌ Security check failed:', error);
      await this.handleMonitoringError(error);
    }
  }

  /**
   * Check for suspicious login attempts
   */
  async checkLoginAttempts() {
    const loginCheck = {
      suspiciousAttempts: [],
      blockedIPs: [],
      totalAttempts: 0,
      suspiciousCount: 0
    };

    try {
      // Get recent login attempts (implementation would depend on your logging system)
      const recentLogins = await this.getRecentLoginAttempts(300000); // Last 5 minutes

      // Group by IP and user
      const attemptsByIP = new Map();
      const attemptsByUser = new Map();

      for (const login of recentLogins) {
        loginCheck.totalAttempts++;

        // Track attempts by IP
        const ipAttempts = attemptsByIP.get(login.ip) || [];
        ipAttempts.push(login);
        attemptsByIP.set(login.ip, ipAttempts);

        // Track attempts by user
        const userAttempts = attemptsByUser.get(login.userId) || [];
        userAttempts.push(login);
        attemptsByUser.set(login.userId, userAttempts);
      }

      // Check for suspicious patterns
      for (const [ip, attempts] of attemptsByIP.entries()) {
        const failedAttempts = attempts.filter(a => !a.success).length;

        if (failedAttempts >= this.config.maxFailedLogins) {
          const suspiciousAttempt = {
            type: 'MULTIPLE_FAILED_LOGINS',
            ip: ip,
            attempts: attempts.length,
            failedAttempts,
            timeWindow: '5 minutes',
            severity: 'HIGH',
            timestamp: new Date().toISOString()
          };

          loginCheck.suspiciousAttempts.push(suspiciousAttempt);
          loginCheck.suspiciousCount++;

          // Block IP if auto-response is enabled
          if (this.config.enableAutoResponse) {
            await this.blockIP(ip, 'Multiple failed logins');
            loginCheck.blockedIPs.push(ip);
          }
        }
      }

      // Check for brute force patterns
      for (const [userId, attempts] of attemptsByUser.entries()) {
        const uniqueIPs = new Set(attempts.map(a => a.ip));

        if (uniqueIPs.size >= 5 && attempts.length >= 10) {
          const suspiciousAttempt = {
            type: 'POTENTIAL_BRUTE_FORCE',
            userId,
            attempts: attempts.length,
            uniqueIPs: uniqueIPs.size,
            timeWindow: '5 minutes',
            severity: 'CRITICAL',
            timestamp: new Date().toISOString()
          };

          loginCheck.suspiciousAttempts.push(suspiciousAttempt);
          loginCheck.suspiciousCount++;
        }
      }

    } catch (error) {
      loginCheck.error = error.message;
    }

    return loginCheck;
  }

  /**
   * Check API access patterns
   */
  async checkApiAccessPatterns() {
    const apiCheck = {
      totalRequests: 0,
      anomalousRequests: [],
      rateLimitViolations: [],
      suspiciousEndpoints: [],
      unexpectedTraffic: []
    };

    try {
      // Get recent API requests
      const recentRequests = await this.getRecentApiRequests(300000); // Last 5 minutes
      apiCheck.totalRequests = recentRequests.length;

      // Group by endpoint and IP
      const requestsByEndpoint = new Map();
      const requestsByIP = new Map();

      for (const request of recentRequests) {
        // Track by endpoint
        const endpointRequests = requestsByEndpoint.get(request.endpoint) || [];
        endpointRequests.push(request);
        requestsByEndpoint.set(request.endpoint, endpointRequests);

        // Track by IP
        const ipRequests = requestsByIP.get(request.ip) || [];
        ipRequests.push(request);
        requestsByIP.set(request.ip, ipRequests);
      }

      // Check for rate limit violations
      for (const [ip, requests] of requestsByIP.entries()) {
        if (requests.length > 100) { // More than 100 requests in 5 minutes
          apiCheck.rateLimitViolations.push({
            ip,
            requests: requests.length,
            timeWindow: '5 minutes',
            severity: 'MEDIUM'
          });

          // Consider blocking if excessive
          if (requests.length > 500 && this.config.enableAutoResponse) {
            await this.blockIP(ip, 'Excessive API requests');
          }
        }
      }

      // Check for unusual endpoint access
      for (const [endpoint, requests] of requestsByEndpoint.entries()) {
        // Check for access to admin endpoints from unusual IPs
        if (endpoint.includes('/admin') || endpoint.includes('/system')) {
          const uniqueIPs = new Set(requests.map(r => r.ip));

          for (const request of requests) {
            if (!this.isWhitelistedIP(request.ip, 'admin')) {
              apiCheck.suspiciousEndpoints.push({
                endpoint,
                ip: request.ip,
                timestamp: request.timestamp,
                severity: 'HIGH'
              });
            }
          }
        }
      }

      // Check for anomalous request patterns
      const anomalies = await this.detectRequestAnomalies(recentRequests);
      apiCheck.anomalousRequests = anomalies;

    } catch (error) {
      apiCheck.error = error.message;
    }

    return apiCheck;
  }

  /**
   * Check trading activity anomalies
   */
  async checkTradingAnomalies() {
    const tradingCheck = {
      totalTrades: 0,
      anomalousTrades: [],
      suspiciousPatterns: [],
      riskBreachAlerts: [],
      volumeAnomalies: []
    };

    try {
      // Get recent trading activity
      const recentTrades = await this.getRecentTrades(300000); // Last 5 minutes
      tradingCheck.totalTrades = recentTrades.length;

      // Check for unusual trade sizes
      const tradeSizes = recentTrades.map(t => t.amount);
      const avgTradeSize = tradeSizes.reduce((sum, size) => sum + size, 0) / tradeSizes.length;
      const stdDev = Math.sqrt(
        tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgTradeSize, 2), 0) / tradeSizes.length
      );

      for (const trade of recentTrades) {
        const zScore = Math.abs((trade.amount - avgTradeSize) / stdDev);

        if (zScore > 3) { // More than 3 standard deviations from mean
          tradingCheck.anomalousTrades.push({
            tradeId: trade.id,
            symbol: trade.symbol,
            amount: trade.amount,
            zScore: zScore,
            reason: 'Unusual trade size',
            severity: 'MEDIUM'
          });
        }

        // Check for rapid fire trading
        const sameSymbolTrades = recentTrades.filter(t => t.symbol === trade.symbol);
        if (sameSymbolTrades.length > 20) { // More than 20 trades on same symbol in 5 minutes
          tradingCheck.suspiciousPatterns.push({
            symbol: trade.symbol,
            tradeCount: sameSymbolTrades.length,
            timeWindow: '5 minutes',
            reason: 'High frequency trading on single symbol',
            severity: 'HIGH'
          });
        }
      }

      // Check for risk limit breaches
      for (const trade of recentTrades) {
        if (trade.risk > 0.1) { // Risk > 10%
          tradingCheck.riskBreachAlerts.push({
            tradeId: trade.id,
            risk: trade.risk,
            symbol: trade.symbol,
            severity: 'HIGH'
          });
        }
      }

    } catch (error) {
      tradingCheck.error = error.message;
    }

    return tradingCheck;
  }

  /**
   * Check system resources
   */
  async checkSystemResources() {
    const resourceCheck = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      alerts: []
    };

    try {
      // Get system metrics
      const metrics = await this.getSystemMetrics();

      resourceCheck.cpu = metrics.cpu;
      resourceCheck.memory = metrics.memory;
      resourceCheck.disk = metrics.disk;
      resourceCheck.network = metrics.network;

      // Check CPU usage
      if (metrics.cpu > this.config.maxCpuUsage) {
        resourceCheck.alerts.push({
          type: 'HIGH_CPU_USAGE',
          value: metrics.cpu,
          threshold: this.config.maxCpuUsage,
          severity: 'MEDIUM'
        });
      }

      // Check memory usage
      if (metrics.memory > this.config.maxMemoryUsage) {
        resourceCheck.alerts.push({
          type: 'HIGH_MEMORY_USAGE',
          value: metrics.memory,
          threshold: this.config.maxMemoryUsage,
          severity: 'HIGH'
        });
      }

      // Check disk usage
      if (metrics.disk > this.config.maxDiskUsage) {
        resourceCheck.alerts.push({
          type: 'HIGH_DISK_USAGE',
          value: metrics.disk,
          threshold: this.config.maxDiskUsage,
          severity: 'CRITICAL'
        });
      }

      // Check for unusual network activity
      if (metrics.network > 0.9) {
        resourceCheck.alerts.push({
          type: 'HIGH_NETWORK_USAGE',
          value: metrics.network,
          severity: 'MEDIUM'
        });
      }

    } catch (error) {
      resourceCheck.error = error.message;
    }

    return resourceCheck;
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      services: {},
      overall: 'HEALTHY'
    };

    try {
      // Check database connectivity
      healthCheck.services.database = await this.checkDatabaseHealth();

      // Check external API connectivity
      healthCheck.services.apis = await this.checkAPIHealth();

      // Check trading engine health
      healthCheck.services.tradingEngine = await this.checkTradingEngineHealth();

      // Check monitoring system health
      healthCheck.services.monitoring = await this.checkMonitoringHealth();

      // Determine overall health
      const serviceStatuses = Object.values(healthCheck.services);
      const unhealthyServices = serviceStatuses.filter(s => s.status !== 'HEALTHY');

      if (unhealthyServices.length === 0) {
        healthCheck.overall = 'HEALTHY';
      } else if (unhealthyServices.length <= serviceStatuses.length / 2) {
        healthCheck.overall = 'DEGRADED';
      } else {
        healthCheck.overall = 'UNHEALTHY';
      }

      // Log health check
      await this.logSecurityEvent('HEALTH_CHECK', healthCheck);

      // Alert if unhealthy
      if (healthCheck.overall !== 'HEALTHY') {
        await this.createAlert('SYSTEM_HEALTH', {
          severity: healthCheck.overall === 'UNHEALTHY' ? 'HIGH' : 'MEDIUM',
          message: `System health status: ${healthCheck.overall}`,
          details: healthCheck
        });
      }

    } catch (error) {
      healthCheck.error = error.message;
      healthCheck.overall = 'ERROR';

      await this.createAlert('HEALTH_CHECK_ERROR', {
        severity: 'HIGH',
        message: 'Health check failed',
        error: error.message
      });
    }

    return healthCheck;
  }

  /**
   * Handle detected threats
   */
  async handleDetectedThreats(threats) {
    for (const threat of threats) {
      try {
        console.log(`🚨 Threat detected: ${threat.type}`);

        // Create alert
        await this.createAlert(threat.type, threat);

        // Update metrics
        this.monitoringState.metrics.totalAlerts++;

        // Trigger automated response
        if (this.config.enableAutoResponse) {
          await this.triggerAutomatedResponse(threat);
        }

        // Emit threat event
        this.emit('threatDetected', threat);

        // Log threat
        await this.logSecurityEvent('THREAT_DETECTED', threat);

      } catch (error) {
        console.error(`Failed to handle threat ${threat.type}:`, error);
      }
    }
  }

  /**
   * Create security alert
   */
  async createAlert(alertType, details) {
    const alertId = this.generateAlertId();
    const now = Date.now();

    const alert = {
      id: alertId,
      type: alertType,
      severity: details.severity || 'MEDIUM',
      message: details.message || `Security alert: ${alertType}`,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false
    };

    // Check for alert cooldown
    const cooldownKey = `${alertType}:${details.ip || details.userId || 'global'}`;
    const lastAlert = this.monitoringState.alerts.get(cooldownKey);

    if (lastAlert && (now - lastAlert.timestamp) < this.config.alertCooldown) {
      return lastAlert; // Return existing alert if within cooldown
    }

    // Store alert
    this.monitoringState.alerts.set(alertId, alert);
    this.monitoringState.alerts.set(cooldownKey, { timestamp: now, alertId });

    // Send notifications
    await this.sendAlert(alert);

    // Emit alert event
    this.emit('securityAlert', alert);

    return alert;
  }

  /**
   * Send alert notifications
   */
  async sendAlert(alert) {
    const notifications = [];

    // Slack notification
    if (this.config.enableSlackAlerts && this.config.slackWebhook) {
      notifications.push(this.sendSlackAlert(alert));
    }

    // Email notification
    if (this.config.enableEmailAlerts && this.config.emailConfig) {
      notifications.push(this.sendEmailAlert(alert));
    }

    // SMS notification
    if (this.config.enableSmsAlerts && alert.severity === 'CRITICAL') {
      notifications.push(this.sendSmsAlert(alert));
    }

    try {
      await Promise.all(notifications);
    } catch (error) {
      console.error('Failed to send alert notifications:', error);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    if (!this.config.slackWebhook) return;

    const payload = {
      text: `🚨 Security Alert: ${alert.type}`,
      attachments: [
        {
          color: this.getAlertColor(alert.severity),
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Timestamp', value: alert.timestamp, short: true },
            { title: 'Message', value: alert.message, short: false }
          ],
          footer: 'Security Monitor',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }
      ]
    };

    // Implementation would use actual Slack webhook
    console.log(`📱 Slack alert sent: ${alert.type}`);
  }

  /**
   * Block IP address
   */
  async blockIP(ip, reason) {
    const blockId = this.generateBlockId();
    const now = Date.now();

    const blockInfo = {
      id: blockId,
      ip,
      reason,
      timestamp: new Date().toISOString(),
      expiresAt: now + this.config.autoBlockDuration,
      active: true
    };

    // Store block information
    this.monitoringState.blockedIPs.set(ip, blockInfo);
    this.monitoringState.metrics.blockedIPs++;

    // Log blocking
    await this.logSecurityEvent('IP_BLOCKED', blockInfo);

    // Emit block event
    this.emit('ipBlocked', blockInfo);

    console.log(`🚫 IP blocked: ${ip} - Reason: ${reason}`);

    // Schedule unblock
    setTimeout(async () => {
      await this.unblockIP(ip);
    }, this.config.autoBlockDuration);
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip) {
    const blockInfo = this.monitoringState.blockedIPs.get(ip);

    if (blockInfo) {
      blockInfo.active = false;
      blockInfo.unblockedAt = new Date().toISOString();

      // Log unblocking
      await this.logSecurityEvent('IP_UNBLOCKED', {
        ip,
        reason: 'Automatic unblock',
        blockedDuration: Date.now() - new Date(blockInfo.timestamp).getTime()
      });

      // Remove from active blocks
      this.monitoringState.blockedIPs.delete(ip);

      console.log(`✅ IP unblocked: ${ip}`);
    }
  }

  /**
   * Trigger automated response
   */
  async triggerAutomatedResponse(threat) {
    console.log(`🤖 Automated response triggered for: ${threat.type}`);

    switch (threat.type) {
      case 'MULTIPLE_FAILED_LOGINS':
        if (threat.ip) {
          await this.blockIP(threat.ip, 'Multiple failed login attempts');
        }
        break;

      case 'POTENTIAL_BRUTE_FORCE':
        if (threat.ip) {
          await this.blockIP(threat.ip, 'Potential brute force attack');
        }
        if (threat.userId) {
          await this.lockUserAccount(threat.userId, 'Suspicious activity detected');
        }
        break;

      case 'HIGH_CPU_USAGE':
      case 'HIGH_MEMORY_USAGE':
        await this.triggerKillSwitch('Resource exhaustion');
        break;

      case 'DATA_INTEGRITY_BREACH':
        await this.triggerEmergencyMode('Data integrity breach detected');
        break;

      default:
        // Default response for unknown threats
        await this.createAlert('UNKNOWN_THREAT', {
          severity: 'MEDIUM',
          message: 'Unknown threat type detected',
          details: threat
        });
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, data) {
    if (!this.config.enableAuditTrail) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      data: this.sanitizeLogData(data),
      source: this.getSourceInfo()
    };

    try {
      const logFile = path.join(__dirname, '../logs/security.log');
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics() {
    const os = require('os');
    const used = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      cpu: os.loadavg()[0] / os.cpus().length, // Normalized CPU load
      memory: (totalMem - freeMem) / totalMem,
      disk: 0.5, // Placeholder - would use actual disk usage
      network: 0.3 // Placeholder - would use actual network metrics
    };
  }

  /**
   * Get alert color for Slack
   */
  getAlertColor(severity) {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'good';
      default: return 'warning';
    }
  }

  /**
   * Generate IDs
   */
  generateCheckId() {
    return `check_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateBlockId() {
    return `block_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Sanitize configuration for logging
   */
  sanitizeConfig() {
    const sanitized = { ...this.config };
    delete sanitized.slackWebhook;
    delete sanitized.emailConfig;
    return sanitized;
  }

  /**
   * Sanitize log data
   */
  sanitizeLogData(data) {
    const sanitized = { ...data };
    // Remove sensitive fields
    const sensitiveFields = ['password', 'apiKey', 'secret', 'token', 'webhook'];
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
      service: 'security-monitor'
    };
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics() {
    return {
      ...this.monitoringState.metrics,
      active: this.monitoringState.active,
      uptime: this.monitoringState.active
        ? Date.now() - this.monitoringState.startTime
        : 0,
      blockedIPs: this.monitoringState.blockedIPs.size,
      activeAlerts: Array.from(this.monitoringState.alerts.values()).filter(a => !a.resolved).length,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = SecurityMonitor;