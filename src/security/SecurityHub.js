/**
 * Security Hub - Central Integration Point for All Security Systems
 * Coordinates and manages all security components for the algorithmic trading platform
 */

const { EventEmitter } = require('events');
const SecurityManager = require('./SecurityManager');
const CodeReviewSystem = require('./CodeReviewSystem');
const KeyManager = require('./KeyManager');
const SecurityMonitor = require('../monitoring/SecurityMonitor');
const DeploymentAuditor = require('../monitoring/DeploymentAuditor');
const VulnerabilityScanner = require('./VulnerabilityScanner');
const StrategyValidator = require('../strategies/StrategyValidator');
const TestSuite = require('../testing/TestSuite');

class SecurityHub extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Hub configuration
      enableAllComponents: config.enableAllComponents !== false,
      autoStartMonitoring: config.autoStartMonitoring !== false,

      // Component configurations
      securityManager: config.securityManager || {},
      codeReview: config.codeReview || {},
      keyManager: config.keyManager || {},
      securityMonitor: config.securityMonitor || {},
      deploymentAuditor: config.deploymentAuditor || {},
      vulnerabilityScanner: config.vulnerabilityScanner || {},
      strategyValidator: config.strategyValidator || {},
      testSuite: config.testSuite || {},

      // Integration settings
      enableCrossComponentAlerts: config.enableCrossComponentAlerts !== false,
      enableCentralLogging: config.enableCentralLogging !== false,
      enableMetricsAggregation: config.enableMetricsAggregation !== false,

      ...config
    };

    this.components = new Map();
    this.metrics = {
      totalSecurityEvents: 0,
      criticalAlerts: 0,
      automatedResponses: 0,
      componentsActive: 0,
      overallHealthScore: 100
    };

    this.initializeSecurityHub();
  }

  /**
   * Initialize Security Hub and all components
   */
  async initializeSecurityHub() {
    try {
      console.log('🛡️ Initializing Security Hub...');

      // Initialize all security components
      await this.initializeComponents();

      // Setup cross-component integration
      this.setupCrossComponentIntegration();

      // Setup centralized logging
      if (this.config.enableCentralLogging) {
        this.setupCentralLogging();
      }

      // Setup metrics aggregation
      if (this.config.enableMetricsAggregation) {
        this.setupMetricsAggregation();
      }

      // Start monitoring if configured
      if (this.config.autoStartMonitoring) {
        await this.startSecurityMonitoring();
      }

      console.log('✅ Security Hub initialized successfully');
      console.log(`🔧 Active components: ${this.components.size}`);

      // Emit hub ready event
      this.emit('securityHubReady', {
        componentsCount: this.components.size,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Failed to initialize Security Hub:', error);
      throw error;
    }
  }

  /**
   * Initialize all security components
   */
  async initializeComponents() {
    if (this.config.enableAllComponents) {
      // Security Manager
      if (this.config.securityManager.enabled !== false) {
        const securityManager = new SecurityManager(this.config.securityManager);
        this.components.set('securityManager', securityManager);
        this.setupComponentEvents('securityManager', securityManager);
      }

      // Code Review System
      if (this.config.codeReview.enabled !== false) {
        const codeReviewSystem = new CodeReviewSystem(this.config.codeReview);
        this.components.set('codeReviewSystem', codeReviewSystem);
        this.setupComponentEvents('codeReviewSystem', codeReviewSystem);
      }

      // Key Manager
      if (this.config.keyManager.enabled !== false) {
        const keyManager = new KeyManager(this.config.keyManager);
        this.components.set('keyManager', keyManager);
        this.setupComponentEvents('keyManager', keyManager);
      }

      // Security Monitor
      if (this.config.securityMonitor.enabled !== false) {
        const securityMonitor = new SecurityMonitor(this.config.securityMonitor);
        this.components.set('securityMonitor', securityMonitor);
        this.setupComponentEvents('securityMonitor', securityMonitor);
      }

      // Deployment Auditor
      if (this.config.deploymentAuditor.enabled !== false) {
        const deploymentAuditor = new DeploymentAuditor(this.config.deploymentAuditor);
        this.components.set('deploymentAuditor', deploymentAuditor);
        this.setupComponentEvents('deploymentAuditor', deploymentAuditor);
      }

      // Vulnerability Scanner
      if (this.config.vulnerabilityScanner.enabled !== false) {
        const vulnerabilityScanner = new VulnerabilityScanner(this.config.vulnerabilityScanner);
        this.components.set('vulnerabilityScanner', vulnerabilityScanner);
        this.setupComponentEvents('vulnerabilityScanner', vulnerabilityScanner);
      }

      // Strategy Validator
      if (this.config.strategyValidator.enabled !== false) {
        const strategyValidator = new StrategyValidator(this.config.strategyValidator);
        this.components.set('strategyValidator', strategyValidator);
        this.setupComponentEvents('strategyValidator', strategyValidator);
      }

      // Test Suite
      if (this.config.testSuite.enabled !== false) {
        const testSuite = new TestSuite(this.config.testSuite);
        this.components.set('testSuite', testSuite);
        this.setupComponentEvents('testSuite', testSuite);
      }
    }

    this.metrics.componentsActive = this.components.size;
  }

  /**
   * Setup cross-component integration
   */
  setupCrossComponentIntegration() {
    if (!this.config.enableCrossComponentAlerts) return;

    // Security event propagation
    this.on('componentAlert', async (alert) => {
      await this.handleCrossComponentAlert(alert);
    });

    // Coordinated incident response
    this.on('criticalThreat', async (threat) => {
      await this.coordinateIncidentResponse(threat);
    });

    // Health status monitoring
    setInterval(async () => {
      await this.updateOverallHealth();
    }, 60000); // Every minute
  }

  /**
   * Setup component event handlers
   */
  setupComponentEvents(componentName, component) {
    // Forward component events to hub
    component.on('securityAlert', (alert) => {
      this.emit('componentAlert', { componentName, alert });
      this.metrics.totalSecurityEvents++;
    });

    component.on('criticalThreat', (threat) => {
      this.emit('criticalThreat', { componentName, threat });
      this.metrics.criticalAlerts++;
    });

    component.on('automatedResponse', (response) => {
      this.metrics.automatedResponses++;
      this.logSecurityEvent('AUTOMATED_RESPONSE', {
        componentName,
        response
      });
    });

    // Health monitoring
    if (component.getHealthStatus) {
      setInterval(async () => {
        try {
          const health = await component.getHealthStatus();
          if (health.status !== 'HEALTHY') {
            this.emit('componentHealthIssue', { componentName, health });
          }
        } catch (error) {
          this.emit('componentHealthIssue', { componentName, error: error.message });
        }
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Start comprehensive security monitoring
   */
  async startSecurityMonitoring() {
    const securityMonitor = this.components.get('securityMonitor');
    if (securityMonitor) {
      await securityMonitor.startMonitoring();
      console.log('🔍 Security monitoring started');
    } else {
      console.warn('⚠️ Security Monitor component not available');
    }
  }

  /**
   * Stop security monitoring
   */
  async stopSecurityMonitoring() {
    const securityMonitor = this.components.get('securityMonitor');
    if (securityMonitor) {
      await securityMonitor.stopMonitoring();
      console.log('🛑 Security monitoring stopped');
    }
  }

  /**
   * Run comprehensive security assessment
   */
  async runComprehensiveAssessment(projectPath = '.') {
    console.log('🔍 Running comprehensive security assessment...');

    const assessment = {
      id: this.generateAssessmentId(),
      timestamp: new Date().toISOString(),
      projectPath,
      components: {},
      summary: {}
    };

    try {
      // Run vulnerability scanning
      if (this.components.has('vulnerabilityScanner')) {
        console.log('  🔍 Scanning for vulnerabilities...');
        assessment.components.vulnerabilityScan = await this.components.get('vulnerabilityScanner')
          .runComprehensiveScan(projectPath);
      }

      // Run code review
      if (this.components.has('codeReviewSystem')) {
        console.log('  📋 Reviewing code quality...');
        const codeReview = this.components.get('codeReviewSystem');
        const files = await this.getProjectFiles(projectPath);
        assessment.components.codeReview = await codeReview.performBatchReview(files);
      }

      // Run test suite
      if (this.components.has('testSuite')) {
        console.log('  🧪 Running test suite...');
        assessment.components.testing = await this.components.get('testSuite')
          .runFullTestSuite(projectPath);
      }

      // Analyze strategies
      if (this.components.has('strategyValidator')) {
        console.log('  📈 Validating trading strategies...');
        const strategyValidator = this.components.get('strategyValidator');
        const strategies = await this.getTradingStrategies(projectPath);
        assessment.components.strategyValidation = await this.validateStrategies(strategyValidator, strategies);
      }

      // Calculate overall assessment
      assessment.summary = this.calculateAssessmentSummary(assessment.components);

      console.log(`✅ Assessment completed: ${assessment.status}`);
      console.log(`📊 Overall security score: ${assessment.summary.securityScore}/100`);

      // Emit assessment completed event
      this.emit('assessmentCompleted', assessment);

      return assessment;

    } catch (error) {
      console.error(`❌ Assessment failed:`, error);
      assessment.error = error.message;
      assessment.status = 'FAILED';
      throw error;
    }
  }

  /**
   * Perform deployment security check
   */
  async performDeploymentSecurityCheck(deploymentRequest) {
    console.log('🔍 Performing deployment security check...');

    const securityCheck = {
      id: this.generateCheckId(),
      timestamp: new Date().toISOString(),
      deploymentRequest,
      checks: {},
      approved: false,
      securityScore: 0
    };

    try {
      // Run deployment assessment
      if (this.components.has('deploymentAuditor')) {
        console.log('  📋 Assessing deployment readiness...');
        securityCheck.checks.deploymentAssessment = await this.components.get('deploymentAuditor')
          .assessDeployment(deploymentRequest);
      }

      // Final vulnerability scan before deployment
      if (this.components.has('vulnerabilityScanner')) {
        console.log('  🔍 Final vulnerability scan...');
        securityCheck.checks.preDeploymentScan = await this.components.get('vulnerabilityScanner')
          .runComprehensiveScan(deploymentRequest.projectPath || '.');
      }

      // Security policy validation
      console.log('  📜 Validating security policies...');
      securityCheck.checks.policyValidation = await this.validateSecurityPolicies(deploymentRequest);

      // Calculate security score
      securityCheck.securityScore = this.calculateDeploymentSecurityScore(securityCheck.checks);
      securityCheck.approved = securityCheck.securityScore >= 80;

      console.log(`✅ Security check completed: ${securityCheck.approved ? 'APPROVED' : 'REJECTED'}`);
      console.log(`📊 Security score: ${securityCheck.securityScore}/100`);

      // Log deployment security check
      await this.logSecurityEvent('DEPLOYMENT_SECURITY_CHECK', securityCheck);

      // Emit security check completed event
      this.emit('deploymentSecurityCheckCompleted', securityCheck);

      return securityCheck;

    } catch (error) {
      console.error(`❌ Deployment security check failed:`, error);
      securityCheck.error = error.message;
      securityCheck.approved = false;
      throw error;
    }

  /**
   * Handle security incident
   */
  async handleSecurityIncident(incident) {
    console.log(`🚨 Handling security incident: ${incident.type}`);

    const incidentResponse = {
      id: this.generateIncidentId(),
      timestamp: new Date().toISOString(),
      incident,
      actions: [],
      status: 'RESPONDING'
    };

    try {
      // Notify security monitor
      if (this.components.has('securityMonitor')) {
        const monitor = this.components.get('securityMonitor');
        await monitor.createAlert(incident.type, {
          severity: incident.severity,
          message: incident.description,
          details: incident
        });
      }

      // Coordinate automated response
      await this.coordinateAutomatedResponse(incident, incidentResponse);

      // Lock down affected systems if critical
      if (incident.severity === 'CRITICAL') {
        await this.performSystemLockdown(incident, incidentResponse);
      }

      // Document response
      incidentResponse.status = 'RESPONDED';
      incidentResponse.completedAt = new Date().toISOString();

      // Log incident response
      await this.logSecurityEvent('INCIDENT_RESPONSE', incidentResponse);

      // Emit incident response completed event
      this.emit('incidentResponseCompleted', incidentResponse);

      return incidentResponse;

    } catch (error) {
      console.error(`❌ Incident response failed:`, error);
      incidentResponse.error = error.message;
      incidentResponse.status = 'FAILED';
      throw error;
    }
  }

  /**
   * Get comprehensive security status
   */
  async getSecurityStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      hub: {
        active: true,
        componentsActive: this.components.size,
        overallHealthScore: this.metrics.overallHealthScore
      },
      components: {},
      metrics: { ...this.metrics },
      recentAlerts: []
    };

    // Get status from each component
    for (const [name, component] of this.components) {
      try {
        if (component.getStatistics) {
          status.components[name] = await component.getStatistics();
        } else if (component.getHealthStatus) {
          status.components[name] = await component.getHealthStatus();
        } else {
          status.components[name] = { status: 'ACTIVE' };
        }
      } catch (error) {
        status.components[name] = { status: 'ERROR', error: error.message };
      }
    }

    return status;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(timeRange = '24h') {
    console.log(`📊 Generating security report for ${timeRange}...`);

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        timeRange,
        version: '1.0'
      },
      summary: {},
      components: {},
      recommendations: [],
      compliance: {}
    };

    try {
      // Aggregate metrics from all components
      for (const [name, component] of this.components) {
        if (component.getStatistics) {
          report.components[name] = await component.getStatistics();
        }
      }

      // Generate summary
      report.summary = this.generateSecuritySummary(report.components);

      // Generate recommendations
      report.recommendations = this.generateSecurityRecommendations(report.summary);

      // Assess compliance
      report.compliance = await this.assessCompliance(report);

      console.log('✅ Security report generated');

      return report;

    } catch (error) {
      console.error('❌ Failed to generate security report:', error);
      throw error;
    }
  }

  /**
   * Setup centralized logging
   */
  setupCentralLogging() {
    this.on('securityEvent', async (event) => {
      await this.logSecurityEvent(event.type, event.data);
    });

    console.log('📝 Central logging enabled');
  }

  /**
   * Setup metrics aggregation
   */
  setupMetricsAggregation() {
    setInterval(async () => {
      await this.aggregateMetrics();
    }, 300000); // Every 5 minutes

    console.log('📊 Metrics aggregation enabled');
  }

  /**
   * Handle cross-component alerts
   */
  async handleCrossComponentAlert(alert) {
    console.log(`🔔 Cross-component alert: ${alert.alert.type}`);

    // Notify other components
    for (const [name, component] of this.components) {
      if (name !== alert.componentName && component.handleExternalAlert) {
        try {
          await component.handleExternalAlert(alert.alert);
        } catch (error) {
          console.error(`Failed to notify component ${name}:`, error);
        }
      }
    }
  }

  /**
   * Coordinate incident response
   */
  async coordinateIncidentResponse(threat) {
    console.log('🚨 Coordinating incident response across components...');

    // Trigger automated responses in all components
    for (const [name, component] of this.components) {
      if (component.handleEmergency) {
        try {
          await component.handleEmergency(threat.threat);
        } catch (error) {
          console.error(`Emergency response failed in ${name}:`, error);
        }
      }
    }
  }

  /**
   * Update overall health score
   */
  async updateOverallHealth() {
    let totalScore = 0;
    let componentCount = 0;

    for (const [name, component] of this.components) {
      try {
        let healthScore = 100; // Default healthy score

        if (component.getHealthStatus) {
          const health = await component.getHealthStatus();
          if (health.status === 'HEALTHY') {
            healthScore = 100;
          } else if (health.status === 'DEGRADED') {
            healthScore = 70;
          } else if (health.status === 'UNHEALTHY') {
            healthScore = 30;
          } else {
            healthScore = 0;
          }
        }

        totalScore += healthScore;
        componentCount++;
      } catch (error) {
        componentCount++;
      }
    }

    this.metrics.overallHealthScore = componentCount > 0 ? Math.round(totalScore / componentCount) : 0;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      source: 'SecurityHub',
      eventType,
      data: this.sanitizeLogData(data),
      metrics: this.metrics
    };

    console.log(`🛡️ Security Event: ${eventType}`);

    // Emit for external logging systems
    this.emit('securityEvent', logEntry);

    // Could integrate with external logging systems here
    // Example: send to SIEM, log aggregation service, etc.
  }

  /**
   * Helper methods
   */
  generateAssessmentId() {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCheckId() {
    return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateIncidentId() {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeLogData(data) {
    // Remove sensitive information from logs
    const sanitized = JSON.parse(JSON.stringify(data));

    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'apiKey'];

    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  calculateAssessmentSummary(components) {
    let totalScore = 100;
    let vulnerabilities = 0;
    let criticalIssues = 0;

    // Aggregate results from all components
    for (const [componentName, result] of Object.entries(components)) {
      if (result.summary) {
        totalScore = Math.min(totalScore, result.summary.securityScore || result.summary.qualityScore || 100);
        vulnerabilities += result.summary.totalVulnerabilities || 0;
        criticalIssues += result.summary.criticalIssues || 0;
      }
    }

    return {
      securityScore: Math.max(0, totalScore),
      totalVulnerabilities: vulnerabilities,
      criticalIssues,
      status: criticalIssues > 0 ? 'CRITICAL' : totalScore < 70 ? 'NEEDS_ATTENTION' : 'HEALTHY'
    };
  }

  calculateDeploymentSecurityScore(checks) {
    let score = 100;

    // Check deployment assessment
    if (checks.deploymentAssessment && checks.deploymentAssessment.summary) {
      score = Math.min(score, checks.deploymentAssessment.summary.readinessScore || 0);
    }

    // Check pre-deployment scan
    if (checks.preDeploymentScan && checks.preDeploymentScan.summary) {
      const vulnScore = 100 - (checks.preDeploymentScan.summary.criticalIssues * 25);
      score = Math.min(score, Math.max(0, vulnScore));
    }

    // Check policy validation
    if (checks.policyValidation && checks.policyValidation.passed === false) {
      score -= 20;
    }

    return Math.max(0, score);
  }

  async getProjectFiles(projectPath) {
    const fs = require('fs').promises;
    const path = require('path');

    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];

    async function scanDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    await scanDirectory(projectPath);
    return files;
  }

  async validateStrategies(strategyValidator, strategies) {
    const results = [];

    for (const strategy of strategies) {
      try {
        const result = await strategyValidator.validateStrategy(strategy);
        results.push(result);
      } catch (error) {
        results.push({
          strategy: strategy.name,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    return { strategies: results };
  }

  async getTradingStrategies(projectPath) {
    // Placeholder implementation - would scan for actual strategy files
    return [
      {
        name: 'Sample Strategy',
        type: 'momentum',
        timeframe: '1h',
        markets: ['BTC/USD']
      }
    ];
  }

  async validateSecurityPolicies(deploymentRequest) {
    // Placeholder implementation - would validate against security policies
    return {
      passed: true,
      policies: ['API_SECURITY', 'DATA_ENCRYPTION', 'ACCESS_CONTROL']
    };
  }

  generateSecuritySummary(components) {
    const summary = {
      totalVulnerabilities: 0,
      criticalIssues: 0,
      securityScore: 100,
      componentHealth: {}
    };

    for (const [name, stats] of Object.entries(components)) {
      if (stats.totalVulnerabilities) {
        summary.totalVulnerabilities += stats.totalVulnerabilities;
      }
      if (stats.criticalIssuesFound) {
        summary.criticalIssues += stats.criticalIssuesFound;
      }

      summary.componentHealth[name] = stats.status || 'ACTIVE';
    }

    // Calculate overall score
    if (summary.criticalIssues > 0) {
      summary.securityScore -= 50;
    }
    summary.securityScore -= Math.min(30, summary.totalVulnerabilities * 2);
    summary.securityScore = Math.max(0, summary.securityScore);

    return summary;
  }

  generateSecurityRecommendations(summary) {
    const recommendations = [];

    if (summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Address Critical Security Issues',
        description: `Resolve ${summary.criticalIssues} critical vulnerabilities immediately`
      });
    }

    if (summary.totalVulnerabilities > 10) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Reduce Vulnerability Count',
        description: `Address ${summary.totalVulnerabilities} total vulnerabilities to improve security posture`
      });
    }

    if (summary.securityScore < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Improve Security Score',
        description: `Current security score is ${summary.securityScore}/100. Implement recommended security improvements.`
      });
    }

    return recommendations;
  }

  async assessCompliance(report) {
    // Placeholder compliance assessment
    return {
      status: 'COMPLIANT',
      frameworks: ['SOC2', 'ISO27001'],
      score: 95
    };
  }
}

module.exports = SecurityHub;