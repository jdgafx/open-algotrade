/**
 * Code Review and Quality Validation System for Algorithmic Trading
 * Ensures code quality, security, and performance standards before deployment
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CodeReviewSystem {
  constructor(config = {}) {
    this.config = {
      // Quality thresholds
      minCodeCoverage: config.minCodeCoverage || 85,
      maxComplexity: config.maxComplexity || 10,
      maxFunctionLength: config.maxFunctionLength || 50,
      maxFileLines: config.maxFileLines || 500,

      // Security checks
      enableSecurityScan: config.enableSecurityScan !== false,
      enableDependencyScan: config.enableDependencyScan !== false,

      // Performance checks
      enablePerformanceAnalysis: config.enablePerformanceAnalysis !== false,
      maxResponseTime: config.maxResponseTime || 100, // ms

      // Review rules
      requireStrategyTests: config.requireStrategyTests !== false,
      requireRiskManagement: config.requireRiskManagement !== false,
      requireErrorHandling: config.requireErrorHandling !== false,

      ...config
    };

    this.reviewHistory = [];
    this.qualityMetrics = {
      totalReviews: 0,
      passedReviews: 0,
      failedReviews: 0,
      averageQualityScore: 0,
      securityIssuesFound: 0,
      performanceIssuesFound: 0
    };

    this.initializeReviewRules();
  }

  /**
   * Initialize review rules and patterns
   */
  initializeReviewRules() {
    this.securityPatterns = [
      // Hardcoded credentials
      {
        pattern: /(password|secret|key|token)\s*[:=]\s*['"]\w+['"]/gi,
        severity: 'HIGH',
        message: 'Hardcoded credentials detected'
      },
      // SQL injection vulnerabilities
      {
        pattern: /\$\{.*\}|query\(`.*\$\{.*\}.*`\)/g,
        severity: 'HIGH',
        message: 'Potential SQL injection vulnerability'
      },
      // Command injection
      {
        pattern: /exec\(|eval\(|Function\(|setTimeout\(.*\$\{.*\}/g,
        severity: 'HIGH',
        message: 'Command injection vulnerability'
      },
      // Weak cryptography
      {
        pattern: /md5\(|sha1\(/gi,
        severity: 'MEDIUM',
        message: 'Weak cryptographic algorithm detected'
      },
      // Debug statements
      {
        pattern: /console\.log|console\.debug|console\.warn/g,
        severity: 'LOW',
        message: 'Debug statement found'
      }
    ];

    this.performancePatterns = [
      // Inefficient loops
      {
        pattern: /for\s*\(\s*let\s+.*\s*in\s*.*\)/g,
        severity: 'MEDIUM',
        message: 'Inefficient for...in loop detected'
      },
      // Synchronous file operations
      {
        pattern: /\.readFileSync\(|\.writeFileSync\(/g,
        severity: 'MEDIUM',
        message: 'Synchronous file operation detected'
      },
      // Memory leaks
      {
        pattern: /setInterval\(.*\)\s*$/gm,
        severity: 'HIGH',
        message: 'Potential memory leak: setInterval without cleanup'
      }
    ];

    this.tradingPatterns = [
      // Required error handling
      {
        pattern: /catch\s*\(\s*\)\s*\{\s*\}/g,
        severity: 'HIGH',
        message: 'Empty catch block detected'
      },
      // Required risk management
      {
        pattern: /(?:executeTrade|placeOrder|buy|sell)\([^)]*\)(?!\s*if\s*\([^)]*\))/g,
        severity: 'HIGH',
        message: 'Trade execution without risk validation'
      },
      // Required position sizing
      {
        pattern: /(?:quantity|amount|size)\s*[:=]\s*[^;}\n]+(?!\s*\/\*.*\*\/)/g,
        severity: 'MEDIUM',
        message: 'Position sizing without risk calculation'
      }
    ];
  }

  /**
   * Perform comprehensive code review
   */
  async performReview(filePath, fileContent = null) {
    const reviewId = this.generateReviewId();
    const startTime = Date.now();

    try {
      // Read file content if not provided
      if (!fileContent) {
        fileContent = await fs.readFile(filePath, 'utf8');
      }

      const review = {
        id: reviewId,
        timestamp: new Date().toISOString(),
        filePath: filePath,
        status: 'IN_PROGRESS',
        results: {},
        summary: {}
      };

      console.log(`🔍 Starting code review for ${filePath}`);

      // 1. Basic file analysis
      review.results.fileAnalysis = await this.analyzeFile(filePath, fileContent);

      // 2. Security analysis
      if (this.config.enableSecurityScan) {
        review.results.securityAnalysis = await this.performSecurityScan(fileContent);
      }

      // 3. Performance analysis
      if (this.config.enablePerformanceAnalysis) {
        review.results.performanceAnalysis = await this.performPerformanceAnalysis(fileContent);
      }

      // 4. Trading-specific analysis
      if (this.isTradingFile(filePath)) {
        review.results.tradingAnalysis = await this.performTradingAnalysis(fileContent);
      }

      // 5. Code quality metrics
      review.results.qualityMetrics = await this.calculateQualityMetrics(fileContent);

      // 6. Test coverage analysis
      if (this.config.requireStrategyTests) {
        review.results.testCoverage = await this.analyzeTestCoverage(filePath);
      }

      // 7. Dependency analysis
      if (this.config.enableDependencyScan) {
        review.results.dependencyAnalysis = await this.analyzeDependencies(fileContent);
      }

      // Calculate overall score and status
      review.summary = await this.calculateReviewSummary(review.results);

      // Update review status
      review.status = review.summary.passed ? 'PASSED' : 'FAILED';
      review.duration = Date.now() - startTime;

      // Store review results
      await this.storeReviewResults(review);

      // Update metrics
      this.updateQualityMetrics(review);

      console.log(`✅ Review completed for ${filePath}: ${review.status}`);
      console.log(`📊 Quality Score: ${review.summary.qualityScore}/100`);

      return review;

    } catch (error) {
      console.error(`❌ Review failed for ${filePath}:`, error);

      const failedReview = {
        id: reviewId,
        timestamp: new Date().toISOString(),
        filePath: filePath,
        status: 'ERROR',
        error: error.message,
        duration: Date.now() - startTime
      };

      await this.storeReviewResults(failedReview);
      throw error;
    }
  }

  /**
   * Analyze file basic properties
   */
  async analyzeFile(filePath, content) {
    const lines = content.split('\n');
    const stats = await fs.stat(filePath);

    return {
      fileName: path.basename(filePath),
      fileExtension: path.extname(filePath),
      fileSize: stats.size,
      lineCount: lines.length,
      emptyLines: lines.filter(line => !line.trim()).length,
      commentLines: lines.filter(line =>
        line.trim().startsWith('//') ||
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*')
      ).length,
      codeLines: lines.length - lines.filter(line =>
        !line.trim() ||
        line.trim().startsWith('//') ||
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*')
      ).length,
      functionCount: this.countFunctions(content),
      classCount: this.countClasses(content)
    };
  }

  /**
   * Perform security vulnerability scan
   */
  async performSecurityScan(content) {
    const securityIssues = [];

    // Check security patterns
    for (const pattern of this.securityPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        securityIssues.push({
          type: pattern.message,
          severity: pattern.severity,
          count: matches.length,
          lineNumbers: this.findLineNumbers(content, matches[0])
        });
      }
    }

    // Additional security checks
    securityIssues.push(...await this.checkCredentialExposure(content));
    securityIssues.push(...await this.checkInputValidation(content));
    securityIssues.push(...await this.checkOutputEncoding(content));

    return {
      issues: securityIssues,
      severityCount: this.countBySeverity(securityIssues),
      score: this.calculateSecurityScore(securityIssues)
    };
  }

  /**
   * Perform performance analysis
   */
  async performPerformanceAnalysis(content) {
    const performanceIssues = [];

    // Check performance patterns
    for (const pattern of this.performancePatterns) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        performanceIssues.push({
          type: pattern.message,
          severity: pattern.severity,
          count: matches.length,
          lineNumbers: this.findLineNumbers(content, matches[0])
        });
      }
    }

    // Additional performance checks
    performanceIssues.push(...await this.checkAlgorithmicComplexity(content));
    performanceIssues.push(...await this.checkMemoryUsage(content));
    performanceIssues.push(...await this.checkAsyncOperations(content));

    return {
      issues: performanceIssues,
      severityCount: this.countBySeverity(performanceIssues),
      score: this.calculatePerformanceScore(performanceIssues)
    };
  }

  /**
   * Perform trading-specific analysis
   */
  async performTradingAnalysis(content) {
    const tradingIssues = [];

    // Check trading patterns
    for (const pattern of this.tradingPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        tradingIssues.push({
          type: pattern.message,
          severity: pattern.severity,
          count: matches.length,
          lineNumbers: this.findLineNumbers(content, matches[0])
        });
      }
    }

    // Additional trading checks
    tradingIssues.push(...await this.checkRiskManagement(content));
    tradingIssues.push(...await this.checkPositionSizing(content));
    tradingIssues.push(...await this.checkStopLoss(content));
    tradingIssues.push(...await this.checkOrderValidation(content));

    return {
      issues: tradingIssues,
      severityCount: this.countBySeverity(tradingIssues),
      score: this.calculateTradingScore(tradingIssues)
    };
  }

  /**
   * Calculate code quality metrics
   */
  async calculateQualityMetrics(content) {
    const metrics = {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(content),
      maintainabilityIndex: this.calculateMaintainabilityIndex(content),
      codeDuplication: this.calculateCodeDuplication(content),
      technicalDebt: this.calculateTechnicalDebt(content),
      documentation: this.analyzeDocumentation(content)
    };

    return metrics;
  }

  /**
   * Analyze test coverage
   */
  async analyzeTestCoverage(filePath) {
    const testFilePath = this.findTestFile(filePath);

    if (!testFilePath) {
      return {
        coverage: 0,
        message: 'No test file found',
        testExists: false
      };
    }

    try {
      const testContent = await fs.readFile(testFilePath, 'utf8');
      const sourceContent = await fs.readFile(filePath, 'utf8');

      const coverage = this.calculateCoverage(sourceContent, testContent);

      return {
        coverage,
        testExists: true,
        testFilePath,
        testFileStats: await this.analyzeFile(testFilePath, testContent)
      };

    } catch (error) {
      return {
        coverage: 0,
        message: `Error reading test file: ${error.message}`,
        testExists: false
      };
    }
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies(content) {
    const dependencies = this.extractDependencies(content);
    const vulnerabilities = [];

    for (const dep of dependencies) {
      const vulnInfo = await this.checkDependencyVulnerability(dep);
      if (vulnInfo) {
        vulnerabilities.push({
          dependency: dep.name,
          version: dep.version,
          vulnerability: vulnInfo
        });
      }
    }

    return {
      dependencies,
      vulnerabilities,
      vulnerabilityCount: vulnerabilities.length,
      score: this.calculateDependencyScore(vulnerabilities)
    };
  }

  /**
   * Calculate review summary
   */
  async calculateReviewSummary(results) {
    let totalScore = 100;
    let passed = true;
    const failures = [];

    // Security check
    if (results.securityAnalysis) {
      const securityScore = results.securityAnalysis.score;
      totalScore = Math.min(totalScore, securityScore);

      if (securityScore < 80) {
        passed = false;
        failures.push('Security score too low');
      }
    }

    // Performance check
    if (results.performanceAnalysis) {
      const performanceScore = results.performanceAnalysis.score;
      totalScore = Math.min(totalScore, performanceScore);

      if (performanceScore < 80) {
        passed = false;
        failures.push('Performance score too low');
      }
    }

    // Trading-specific check
    if (results.tradingAnalysis) {
      const tradingScore = results.tradingAnalysis.score;
      totalScore = Math.min(totalScore, tradingScore);

      if (tradingScore < 90) {
        passed = false;
        failures.push('Trading safety score too low');
      }
    }

    // Quality metrics check
    if (results.qualityMetrics) {
      if (results.qualityMetrics.cyclomaticComplexity > this.config.maxComplexity) {
        totalScore -= 10;
        passed = false;
        failures.push('Code complexity too high');
      }
    }

    // Test coverage check
    if (results.testCoverage) {
      if (results.testCoverage.coverage < this.config.minCodeCoverage) {
        totalScore -= 15;
        passed = false;
        failures.push('Test coverage too low');
      }
    }

    // Dependency check
    if (results.dependencyAnalysis && results.dependencyAnalysis.vulnerabilities.length > 0) {
      totalScore -= 20;
      passed = false;
      failures.push('Dependency vulnerabilities found');
    }

    return {
      qualityScore: Math.max(0, totalScore),
      passed,
      failures,
      recommendation: this.getRecommendation(totalScore, passed)
    };
  }

  /**
   * Check credential exposure
   */
  async checkCredentialExposure(content) {
    const issues = [];

    // Check for common credential patterns
    const credentialPatterns = [
      { pattern: /API_KEY\s*[:=]\s*['"][^'"]{10,}['"]/gi, message: 'API key exposure' },
      { pattern: /SECRET\s*[:=]\s*['"][^'"]{10,}['"]/gi, message: 'Secret key exposure' },
      { pattern: /PASSWORD\s*[:=]\s*['"][^'"]{6,}['"]/gi, message: 'Password exposure' },
      { pattern: /TOKEN\s*[:=]\s*['"][^'"]{10,}['"]/gi, message: 'Token exposure' }
    ];

    for (const credPattern of credentialPatterns) {
      const matches = content.match(credPattern.pattern);
      if (matches) {
        issues.push({
          type: credPattern.message,
          severity: 'CRITICAL',
          count: matches.length,
          lineNumbers: this.findLineNumbers(content, matches[0])
        });
      }
    }

    return issues;
  }

  /**
   * Check input validation
   */
  async checkInputValidation(content) {
    const issues = [];

    // Look for functions that accept user input without validation
    const inputFunctions = content.match(/(?:function|=>)\s*\w*\s*\([^)]*\)\s*\{[^}]*\}/g);

    if (inputFunctions) {
      for (const func of inputFunctions) {
        if (func.includes('req.') || func.includes('params.') || func.includes('query.')) {
          if (!func.includes('validate') && !func.includes('sanitize')) {
            issues.push({
              type: 'Missing input validation',
              severity: 'MEDIUM',
              count: 1
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check risk management in trading code
   */
  async checkRiskManagement(content) {
    const issues = [];

    // Look for trade execution without risk checks
    const tradeExecutions = content.match(/(?:buy|sell|executeTrade|placeOrder)\([^)]*\)/g);

    if (tradeExecutions) {
      for (const execution of tradeExecutions) {
        const precedingLines = this.getPrecedingLines(content, execution, 10);

        if (!precedingLines.some(line =>
          line.includes('risk') ||
          line.includes('limit') ||
          line.includes('maxLoss') ||
          line.includes('positionSize')
        )) {
          issues.push({
            type: 'Trade execution without risk management',
            severity: 'HIGH',
            count: 1
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check stop loss implementation
   */
  async checkStopLoss(content) {
    const issues = [];

    // Look for trades without stop loss
    const tradeExecutions = content.match(/(?:buy|sell|executeTrade)\([^)]*\)/g);

    if (tradeExecutions) {
      for (const execution of tradeExecutions) {
        const precedingLines = this.getPrecedingLines(content, execution, 20);

        if (!precedingLines.some(line =>
          line.includes('stopLoss') ||
          line.includes('stop') ||
          line.includes('sl')
        )) {
          issues.push({
            type: 'Missing stop loss',
            severity: 'HIGH',
            count: 1
          });
        }
      }
    }

    return issues;
  }

  /**
   * Calculate cyclomatic complexity
   */
  calculateCyclomaticComplexity(content) {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPoints = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*[^:]*:/g,
      /&&/g,
      /\|\|/g
    ];

    for (const pattern of decisionPoints) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Find line numbers for pattern matches
   */
  findLineNumbers(content, pattern) {
    const lines = content.split('\n');
    const lineNumbers = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        lineNumbers.push(i + 1);
      }
    }

    return lineNumbers;
  }

  /**
   * Get preceding lines from content
   */
  getPrecedingLines(content, target, count) {
    const lines = content.split('\n');
    const targetIndex = lines.findIndex(line => line.includes(target));

    if (targetIndex === -1) return [];

    return lines.slice(Math.max(0, targetIndex - count), targetIndex);
  }

  /**
   * Count functions in content
   */
  countFunctions(content) {
    const patterns = [
      /function\s+\w+/g,
      /(?:const|let|var)\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>)/g,
      /class\s+\w+/g,
      /\w+\s*:\s*function/g
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }

    return count;
  }

  /**
   * Count classes in content
   */
  countClasses(content) {
    const matches = content.match(/class\s+\w+/g);
    return matches ? matches.length : 0;
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore(issues) {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'CRITICAL': score -= 30; break;
        case 'HIGH': score -= 20; break;
        case 'MEDIUM': score -= 10; break;
        case 'LOW': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(issues) {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'HIGH': score -= 15; break;
        case 'MEDIUM': score -= 10; break;
        case 'LOW': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate trading safety score
   */
  calculateTradingScore(issues) {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'HIGH': score -= 25; break;
        case 'MEDIUM': score -= 15; break;
        case 'LOW': score -= 10; break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Count issues by severity
   */
  countBySeverity(issues) {
    const count = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const issue of issues) {
      count[issue.severity] = (count[issue.severity] || 0) + 1;
    }

    return count;
  }

  /**
   * Check if file is a trading-related file
   */
  isTradingFile(filePath) {
    const tradingKeywords = ['trade', 'strategy', 'order', 'market', 'price', 'api', 'exchange'];
    const fileName = filePath.toLowerCase();

    return tradingKeywords.some(keyword => fileName.includes(keyword));
  }

  /**
   * Find test file for source file
   */
  findTestFile(filePath) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, path.extname(filePath));
    const testExtensions = ['.test.js', '.spec.js', '.test.ts', '.spec.ts'];

    for (const ext of testExtensions) {
      const testPath = path.join(dir, `${name}${ext}`);
      try {
        fs.accessSync(testPath);
        return testPath;
      } catch {}
    }

    return null;
  }

  /**
   * Calculate code coverage
   */
  calculateCoverage(sourceContent, testContent) {
    // Simplified coverage calculation
    const sourceFunctions = this.countFunctions(sourceContent);
    const testedFunctions = this.countTestedFunctions(sourceContent, testContent);

    return sourceFunctions > 0 ? Math.round((testedFunctions / sourceFunctions) * 100) : 0;
  }

  /**
   * Count tested functions
   */
  countTestedFunctions(sourceContent, testContent) {
    const sourceFunctions = sourceContent.match(/function\s+(\w+)|(\w+)\s*:\s*function/g);
    let testedCount = 0;

    if (sourceFunctions) {
      for (const funcMatch of sourceFunctions) {
        const funcName = funcMatch.match(/\w+/)[0];
        if (testContent.includes(funcName)) {
          testedCount++;
        }
      }
    }

    return testedCount;
  }

  /**
   * Get review recommendation
   */
  getRecommendation(score, passed) {
    if (!passed) {
      return 'FAILED - Fix issues before deployment';
    }

    if (score >= 90) {
      return 'EXCELLENT - Ready for production';
    } else if (score >= 80) {
      return 'GOOD - Ready for deployment with monitoring';
    } else if (score >= 70) {
      return 'FAIR - Consider improvements before deployment';
    } else {
      return 'POOR - Requires significant improvements';
    }
  }

  /**
   * Generate review ID
   */
  generateReviewId() {
    return `review_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Store review results
   */
  async storeReviewResults(review) {
    this.reviewHistory.push(review);

    // Keep only last 1000 reviews in memory
    if (this.reviewHistory.length > 1000) {
      this.reviewHistory = this.reviewHistory.slice(-1000);
    }

    // Persist to file system
    try {
      const reviewDir = path.join(__dirname, '../reviews');
      await fs.mkdir(reviewDir, { recursive: true });

      const reviewFile = path.join(reviewDir, `${review.id}.json`);
      await fs.writeFile(reviewFile, JSON.stringify(review, null, 2));
    } catch (error) {
      console.error('Failed to store review results:', error);
    }
  }

  /**
   * Update quality metrics
   */
  updateQualityMetrics(review) {
    this.qualityMetrics.totalReviews++;

    if (review.status === 'PASSED') {
      this.qualityMetrics.passedReviews++;
    } else {
      this.qualityMetrics.failedReviews++;
    }

    if (review.summary.qualityScore) {
      const totalScore = this.qualityMetrics.averageQualityScore * (this.qualityMetrics.totalReviews - 1);
      this.qualityMetrics.averageQualityScore =
        (totalScore + review.summary.qualityScore) / this.qualityMetrics.totalReviews;
    }

    if (review.results.securityAnalysis) {
      this.qualityMetrics.securityIssuesFound += review.results.securityAnalysis.issues.length;
    }

    if (review.results.performanceAnalysis) {
      this.qualityMetrics.performanceIssuesFound += review.results.performanceAnalysis.issues.length;
    }
  }

  /**
   * Get review statistics
   */
  getReviewStatistics() {
    return {
      ...this.qualityMetrics,
      recentReviews: this.reviewHistory.slice(-10),
      passRate: this.qualityMetrics.totalReviews > 0
        ? (this.qualityMetrics.passedReviews / this.qualityMetrics.totalReviews * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Perform batch review
   */
  async performBatchReview(filePaths) {
    const reviews = [];

    for (const filePath of filePaths) {
      try {
        const review = await this.performReview(filePath);
        reviews.push(review);
      } catch (error) {
        reviews.push({
          filePath,
          error: error.message,
          status: 'ERROR'
        });
      }
    }

    return {
      reviews,
      summary: {
        total: reviews.length,
        passed: reviews.filter(r => r.status === 'PASSED').length,
        failed: reviews.filter(r => r.status === 'FAILED').length,
        errors: reviews.filter(r => r.status === 'ERROR').length
      }
    };
  }
}

module.exports = CodeReviewSystem;