/**
 * Strategy Validation and Risk Assessment Framework
 * Validates trading strategies for safety, performance, and risk management before deployment
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class StrategyValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Risk thresholds
      maxDrawdown: config.maxDrawdown || 0.20, // 20%
      maxLeverage: config.maxLeverage || 3,
      maxPositionSize: config.maxPositionSize || 0.1, // 10% of portfolio
      maxDailyLoss: config.maxDailyLoss || 0.05, // 5% daily
      maxConsecutiveLosses: config.maxConsecutiveLosses || 5,

      // Performance requirements
      minWinRate: config.minWinRate || 0.55, // 55%
      minProfitFactor: config.minProfitFactor || 1.5,
      minSharpeRatio: config.minSharpeRatio || 1.0,
      minSortinoRatio: config.minSortinoRatio || 1.2,
      minTradesForValidation: config.minTradesForValidation || 100,

      // Validation settings
      backtestDays: config.backtestDays || 365,
      requiredBacktests: config.requiredBacktests || 3,
      enableMonteCarlo: config.enableMonteCarlo !== false,
      monteCarloSimulations: config.monteCarloSimulations || 1000,

      // Risk management requirements
      requireStopLoss: config.requireStopLoss !== false,
      requireTakeProfit: config.requireTakeProfit || false,
      requirePositionSizing: config.requirePositionSizing !== false,
      requireRiskRewardRatio: config.requireRiskRewardRatio !== false,
      minRiskRewardRatio: config.minRiskRewardRatio || 1.5,

      ...config
    };

    this.validationHistory = [];
    this.riskMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      averageRiskScore: 0,
      highestRiskStrategy: null,
      lowestRiskStrategy: null
    };

    this.initializeValidator();
  }

  /**
   * Initialize strategy validator
   */
  initializeValidator() {
    console.log('🎯 Strategy Validator initialized');
    console.log(`📊 Risk thresholds: Max drawdown ${(this.config.maxDrawdown * 100).toFixed(1)}%, Max leverage ${this.config.maxLeverage}x`);
  }

  /**
   * Validate trading strategy
   */
  async validateStrategy(strategyDefinition, backtestData = null) {
    const validationId = this.generateValidationId();
    const startTime = Date.now();

    try {
      const validation = {
        id: validationId,
        timestamp: new Date().toISOString(),
        strategyName: strategyDefinition.name,
        status: 'IN_PROGRESS',
        results: {},
        summary: {}
      };

      console.log(`🔍 Starting validation for strategy: ${strategyDefinition.name}`);

      // 1. Basic validation
      validation.results.basicValidation = await this.performBasicValidation(strategyDefinition);

      // 2. Risk management validation
      validation.results.riskManagement = await this.validateRiskManagement(strategyDefinition);

      // 3. Performance validation
      validation.results.performance = await this.validatePerformance(strategyDefinition, backtestData);

      // 4. Backtest validation
      if (!backtestData) {
        validation.results.backtest = await this.runBacktests(strategyDefinition);
      } else {
        validation.results.backtest = await this.analyzeBacktestData(backtestData);
      }

      // 5. Monte Carlo simulation
      if (this.config.enableMonteCarlo) {
        validation.results.monteCarlo = await this.runMonteCarloSimulation(strategyDefinition, backtestData);
      }

      // 6. Stress testing
      validation.results.stressTest = await this.performStressTesting(strategyDefinition);

      // 7. Risk metrics calculation
      validation.results.riskMetrics = await this.calculateRiskMetrics(strategyDefinition, backtestData);

      // 8. Market regime analysis
      validation.results.regimeAnalysis = await this.performRegimeAnalysis(strategyDefinition, backtestData);

      // Calculate overall validation results
      validation.summary = await this.calculateValidationSummary(validation.results);

      // Update status
      validation.status = validation.summary.approved ? 'APPROVED' : 'REJECTED';
      validation.duration = Date.now() - startTime;

      // Store validation results
      await this.storeValidationResults(validation);

      // Update metrics
      this.updateRiskMetrics(validation);

      console.log(`✅ Validation completed for ${strategyDefinition.name}: ${validation.status}`);
      console.log(`📊 Risk Score: ${validation.summary.riskScore}/100`);
      console.log(`🎯 Approval: ${validation.summary.approved ? 'APPROVED' : 'REJECTED'}`);

      // Emit events
      this.emit('validationCompleted', validation);
      if (!validation.summary.approved) {
        this.emit('validationRejected', validation);
      }

      return validation;

    } catch (error) {
      console.error(`❌ Validation failed for ${strategyDefinition.name}:`, error);

      const failedValidation = {
        id: validationId,
        timestamp: new Date().toISOString(),
        strategyName: strategyDefinition.name,
        status: 'ERROR',
        error: error.message,
        duration: Date.now() - startTime
      };

      await this.storeValidationResults(failedValidation);
      throw error;
    }
  }

  /**
   * Perform basic strategy validation
   */
  async performBasicValidation(strategy) {
    const issues = [];
    let score = 100;

    // Check required fields
    const requiredFields = ['name', 'type', 'timeframe', 'markets'];
    for (const field of requiredFields) {
      if (!strategy[field]) {
        issues.push({
          type: 'MISSING_REQUIRED_FIELD',
          field,
          severity: 'HIGH',
          message: `Required field '${field}' is missing`
        });
        score -= 20;
      }
    }

    // Validate strategy type
    const validTypes = ['momentum', 'mean_reversion', 'arbitrage', 'trend_following', 'market_making'];
    if (strategy.type && !validTypes.includes(strategy.type)) {
      issues.push({
        type: 'INVALID_STRATEGY_TYPE',
        severity: 'MEDIUM',
        message: `Invalid strategy type: ${strategy.type}`
      });
      score -= 10;
    }

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    if (strategy.timeframe && !validTimeframes.includes(strategy.timeframe)) {
      issues.push({
        type: 'INVALID_TIMEFRAME',
        severity: 'MEDIUM',
        message: `Invalid timeframe: ${strategy.timeframe}`
      });
      score -= 10;
    }

    // Check entry/exit logic
    if (!strategy.entryConditions || strategy.entryConditions.length === 0) {
      issues.push({
        type: 'NO_ENTRY_CONDITIONS',
        severity: 'HIGH',
        message: 'Strategy must have entry conditions'
      });
      score -= 30;
    }

    if (!strategy.exitConditions || strategy.exitConditions.length === 0) {
      issues.push({
        type: 'NO_EXIT_CONDITIONS',
        severity: 'HIGH',
        message: 'Strategy must have exit conditions'
      });
      score -= 30;
    }

    return {
      issues,
      score: Math.max(0, score),
      passed: score >= 70
    };
  }

  /**
   * Validate risk management
   */
  async validateRiskManagement(strategy) {
    const issues = [];
    let score = 100;

    // Check stop loss
    if (this.config.requireStopLoss) {
      if (!strategy.stopLoss) {
        issues.push({
          type: 'MISSING_STOP_LOSS',
          severity: 'CRITICAL',
          message: 'Strategy must include stop loss'
        });
        score -= 40;
      } else if (strategy.stopLoss > 0.1) { // More than 10% stop loss
        issues.push({
          type: 'EXCESSIVE_STOP_LOSS',
          severity: 'HIGH',
          message: 'Stop loss is too large (>10%)'
        });
        score -= 20;
      }
    }

    // Check position sizing
    if (this.config.requirePositionSizing) {
      if (!strategy.positionSizing) {
        issues.push({
          type: 'MISSING_POSITION_SIZING',
          severity: 'HIGH',
          message: 'Strategy must include position sizing logic'
        });
        score -= 30;
      }

      // Check maximum position size
      if (strategy.maxPositionSize && strategy.maxPositionSize > this.config.maxPositionSize) {
        issues.push({
          type: 'EXCESSIVE_POSITION_SIZE',
          severity: 'HIGH',
          message: `Maximum position size ${strategy.maxPositionSize} exceeds limit ${this.config.maxPositionSize}`
        });
        score -= 25;
      }
    }

    // Check leverage
    if (strategy.leverage && strategy.leverage > this.config.maxLeverage) {
      issues.push({
        type: 'EXCESSIVE_LEVERAGE',
        severity: 'CRITICAL',
        message: `Leverage ${strategy.leverage}x exceeds maximum ${this.config.maxLeverage}x`
      });
      score -= 35;
    }

    // Check risk/reward ratio
    if (this.config.requireRiskRewardRatio) {
      if (!strategy.riskRewardRatio) {
        issues.push({
          type: 'MISSING_RISK_REWARD_RATIO',
          severity: 'MEDIUM',
          message: 'Strategy should specify risk/reward ratio'
        });
        score -= 15;
      } else if (strategy.riskRewardRatio < this.config.minRiskRewardRatio) {
        issues.push({
          type: 'INADEQUATE_RISK_REWARD_RATIO',
          severity: 'MEDIUM',
          message: `Risk/reward ratio ${strategy.riskRewardRatio} below minimum ${this.config.minRiskRewardRatio}`
        });
        score -= 20;
      }
    }

    // Check daily loss limits
    if (!strategy.maxDailyLoss) {
      issues.push({
        type: 'MISSING_DAILY_LOSS_LIMIT',
        severity: 'HIGH',
        message: 'Strategy must include daily loss limit'
      });
      score -= 25;
    } else if (strategy.maxDailyLoss > this.config.maxDailyLoss) {
      issues.push({
        type: 'EXCESSIVE_DAILY_LOSS_LIMIT',
        severity: 'HIGH',
        message: `Daily loss limit ${strategy.maxDailyLoss} exceeds maximum ${this.config.maxDailyLoss}`
      });
      score -= 20;
    }

    return {
      issues,
      score: Math.max(0, score),
      passed: score >= 70
    };
  }

  /**
   * Validate performance metrics
   */
  async validatePerformance(strategy, backtestData) {
    const issues = [];
    let score = 100;

    if (!backtestData || backtestData.trades.length < this.config.minTradesForValidation) {
      issues.push({
        type: 'INSUFFICIENT_BACKTEST_DATA',
        severity: 'HIGH',
        message: `Need at least ${this.config.minTradesForValidation} trades for validation`
      });
      return { issues, score: 0, passed: false };
    }

    const metrics = this.calculatePerformanceMetrics(backtestData);

    // Check win rate
    if (metrics.winRate < this.config.minWinRate) {
      issues.push({
        type: 'LOW_WIN_RATE',
        severity: 'HIGH',
        message: `Win rate ${(metrics.winRate * 100).toFixed(1)}% below minimum ${(this.config.minWinRate * 100).toFixed(1)}%`
      });
      score -= 30;
    }

    // Check profit factor
    if (metrics.profitFactor < this.config.minProfitFactor) {
      issues.push({
        type: 'LOW_PROFIT_FACTOR',
        severity: 'HIGH',
        message: `Profit factor ${metrics.profitFactor.toFixed(2)} below minimum ${this.config.minProfitFactor}`
      });
      score -= 25;
    }

    // Check Sharpe ratio
    if (metrics.sharpeRatio < this.config.minSharpeRatio) {
      issues.push({
        type: 'LOW_SHARPE_RATIO',
        severity: 'MEDIUM',
        message: `Sharpe ratio ${metrics.sharpeRatio.toFixed(2)} below minimum ${this.config.minSharpeRatio}`
      });
      score -= 20;
    }

    // Check maximum drawdown
    if (metrics.maxDrawdown > this.config.maxDrawdown) {
      issues.push({
        type: 'EXCESSIVE_DRAWDOWN',
        severity: 'CRITICAL',
        message: `Maximum drawdown ${(metrics.maxDrawdown * 100).toFixed(1)}% exceeds limit ${(this.config.maxDrawdown * 100).toFixed(1)}%`
      });
      score -= 40;
    }

    // Check consecutive losses
    if (metrics.maxConsecutiveLosses > this.config.maxConsecutiveLosses) {
      issues.push({
        type: 'EXCESSIVE_CONSECUTIVE_LOSSES',
        severity: 'HIGH',
        message: `Maximum consecutive losses ${metrics.maxConsecutiveLosses} exceeds limit ${this.config.maxConsecutiveLosses}`
      });
      score -= 25;
    }

    return {
      metrics,
      issues,
      score: Math.max(0, score),
      passed: score >= 70
    };
  }

  /**
   * Run backtests
   */
  async runBacktests(strategy) {
    const backtestResults = [];

    // Generate different backtest scenarios
    const scenarios = [
      { name: 'Standard Market', volatility: 1.0, trend: 0.0 },
      { name: 'High Volatility', volatility: 2.0, trend: 0.0 },
      { name: 'Bull Market', volatility: 1.0, trend: 0.5 },
      { name: 'Bear Market', volatility: 1.5, trend: -0.5 },
      { name: 'Sideways Market', volatility: 0.8, trend: 0.0 }
    ];

    for (const scenario of scenarios) {
      const result = await this.runSingleBacktest(strategy, scenario);
      backtestResults.push(result);
    }

    // Analyze backtest consistency
    const consistency = this.analyzeBacktestConsistency(backtestResults);

    return {
      results: backtestResults,
      consistency,
      score: consistency.score,
      passed: consistency.passed
    };
  }

  /**
   * Run Monte Carlo simulation
   */
  async runMonteCarloSimulation(strategy, backtestData) {
    if (!backtestData || backtestData.trades.length === 0) {
      return {
        enabled: false,
        reason: 'No backtest data available'
      };
    }

    const simulations = [];
    const trades = backtestData.trades;

    for (let i = 0; i < this.config.monteCarloSimulations; i++) {
      // Randomize trade sequence
      const shuffledTrades = this.shuffleArray([...trades]);
      const simulationResult = this.simulateTradingPath(shuffledTrades);
      simulations.push(simulationResult);
    }

    // Analyze simulation results
    const analysis = this.analyzeMonteCarloResults(simulations);

    return {
      enabled: true,
      simulations: this.config.monteCarloSimulations,
      analysis,
      score: analysis.score,
      passed: analysis.passed
    };
  }

  /**
   * Perform stress testing
   */
  async performStressTesting(strategy) {
    const stressScenarios = [
      {
        name: 'Market Crash',
        description: 'Sudden 30% market drop',
        marketImpact: -0.30,
        volatilityMultiplier: 3.0
      },
      {
        name: 'Liquidity Crisis',
        description: 'Reduced liquidity with increased spreads',
        spreadMultiplier: 5.0,
        volumeReduction: 0.8
      },
      {
        name: 'Flash Crash',
        description: 'Extreme volatility with quick recovery',
        volatilitySpike: 10.0,
        recoveryTime: 60 // minutes
      },
      {
        name: 'Regime Change',
        description: 'Complete change in market dynamics',
        regimeShift: true
      }
    ];

    const stressResults = [];

    for (const scenario of stressScenarios) {
      const result = await this.runStressTest(strategy, scenario);
      stressResults.push(result);
    }

    // Analyze stress test resilience
    const resilience = this.analyzeStressTestResilience(stressResults);

    return {
      scenarios: stressResults,
      resilience,
      score: resilience.score,
      passed: resilience.passed
    };
  }

  /**
   * Calculate risk metrics
   */
  async calculateRiskMetrics(strategy, backtestData) {
    if (!backtestData) {
      return {
        enabled: false,
        reason: 'No backtest data available'
      };
    }

    const metrics = {
      // VaR calculations
      var95: this.calculateVaR(backtestData.returns, 0.95),
      var99: this.calculateVaR(backtestData.returns, 0.99),

      // CVaR (Expected Shortfall)
      cvar95: this.calculateCVaR(backtestData.returns, 0.95),
      cvar99: this.calculateCVaR(backtestData.returns, 0.99),

      // Risk-adjusted returns
      sharpeRatio: this.calculateSharpeRatio(backtestData.returns),
      sortinoRatio: this.calculateSortinoRatio(backtestData.returns),
      calmarRatio: this.calculateCalmarRatio(backtestData),

      // Maximum drawdown metrics
      maxDrawdown: this.calculateMaxDrawdown(backtestData.equityCurve),
      drawdownDuration: this.calculateDrawdownDuration(backtestData.equityCurve),

      // Portfolio metrics
      beta: this.calculateBeta(backtestData.returns),
      correlation: this.calculateCorrelation(backtestData.returns),

      // Strategy-specific risks
      leverageRisk: this.calculateLeverageRisk(strategy),
      concentrationRisk: this.calculateConcentrationRisk(strategy),
      liquidityRisk: this.calculateLiquidityRisk(strategy),

      // Overall risk score
      riskScore: 0
    };

    // Calculate overall risk score (0-100, higher = riskier)
    metrics.riskScore = this.calculateOverallRiskScore(metrics);

    return metrics;
  }

  /**
   * Perform market regime analysis
   */
  async performRegimeAnalysis(strategy, backtestData) {
    if (!backtestData) {
      return {
        enabled: false,
        reason: 'No backtest data available'
      };
    }

    // Identify market regimes
    const regimes = this.identifyMarketRegimes(backtestData);

    // Analyze performance by regime
    const performanceByRegime = {};

    for (const [regime, periods] of Object.entries(regimes)) {
      performanceByRegime[regime] = this.analyzeRegimePerformance(backtestData, periods);
    }

    // Check regime stability
    const stability = this.analyzeRegimeStability(performanceByRegime);

    return {
      regimes,
      performanceByRegime,
      stability,
      score: stability.score,
      passed: stability.passed
    };
  }

  /**
   * Calculate validation summary
   */
  async calculateValidationSummary(results) {
    let totalScore = 0;
    let weightSum = 0;
    let approved = true;
    const failures = [];

    // Define weights for different validation components
    const weights = {
      basicValidation: 0.15,
      riskManagement: 0.25,
      performance: 0.25,
      backtest: 0.15,
      stressTest: 0.15,
      monteCarlo: 0.05
    };

    // Calculate weighted score
    for (const [component, weight] of Object.entries(weights)) {
      if (results[component]) {
        const componentScore = results[component].score || 0;
        const componentPassed = results[component].passed || false;

        totalScore += componentScore * weight;
        weightSum += weight;

        if (!componentPassed) {
          approved = false;
          failures.push(`${component} validation failed`);
        }
      }
    }

    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

    // Calculate risk score (inverse of quality score for risk assessment)
    const riskScore = 100 - finalScore;

    // Additional checks for critical failures
    if (results.riskManagement) {
      const criticalIssues = results.riskManagement.issues.filter(i => i.severity === 'CRITICAL');
      if (criticalIssues.length > 0) {
        approved = false;
        failures.push('Critical risk management issues found');
      }
    }

    return {
      qualityScore: Math.round(finalScore),
      riskScore: Math.round(riskScore),
      approved,
      failures,
      recommendation: this.getRecommendation(finalScore, approved),
      riskLevel: this.getRiskLevel(riskScore)
    };
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(backtestData) {
    const trades = backtestData.trades;
    const returns = backtestData.returns || this.calculateReturns(trades);

    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit <= 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winningTrades.length / trades.length,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      totalReturn: this.calculateTotalReturn(returns),
      maxDrawdown: this.calculateMaxDrawdown(backtestData.equityCurve),
      maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(trades),
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      calmarRatio: this.calculateCalmarRatio(backtestData)
    };
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  calculateVaR(returns, confidence) {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   */
  calculateCVaR(returns, confidence) {
    const varThreshold = this.calculateVaR(returns, confidence);
    const tailReturns = returns.filter(r => r <= varThreshold);
    return tailReturns.length > 0 ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const annualizedReturn = avgReturn * 252; // Assuming daily returns
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return annualizedStdDev > 0 ? (annualizedReturn - riskFreeRate) / annualizedStdDev : 0;
  }

  /**
   * Calculate Sortino ratio
   */
  calculateSortinoRatio(returns, riskFreeRate = 0.02) {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);

    if (negativeReturns.length === 0) return Infinity;

    const downwardDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    );

    const annualizedReturn = avgReturn * 252;
    const annualizedDownwardDeviation = downwardDeviation * Math.sqrt(252);

    return annualizedDownwardDeviation > 0 ? (annualizedReturn - riskFreeRate) / annualizedDownwardDeviation : 0;
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(equityCurve) {
    if (!equityCurve || equityCurve.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0];

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate maximum consecutive losses
   */
  calculateMaxConsecutiveLosses(trades) {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const trade of trades) {
      if (trade.profit <= 0) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  /**
   * Get validation recommendation
   */
  getRecommendation(score, approved) {
    if (!approved) {
      return 'REJECTED - Address all critical issues before re-submission';
    }

    if (score >= 90) {
      return 'EXCELLENT - Approved for live trading with full capital allocation';
    } else if (score >= 80) {
      return 'GOOD - Approved for live trading with moderate capital allocation';
    } else if (score >= 70) {
      return 'ACCEPTABLE - Approved for paper trading and small position sizing';
    } else {
      return 'MARGINAL - Requires significant improvements before deployment';
    }
  }

  /**
   * Get risk level
   */
  getRiskLevel(riskScore) {
    if (riskScore >= 80) return 'VERY_HIGH';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    if (riskScore >= 20) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Generate validation ID
   */
  generateValidationId() {
    return `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store validation results
   */
  async storeValidationResults(validation) {
    this.validationHistory.push(validation);

    // Keep only last 1000 validations in memory
    if (this.validationHistory.length > 1000) {
      this.validationHistory = this.validationHistory.slice(-1000);
    }

    // Persist to file system
    try {
      const validationDir = path.join(__dirname, '../validations');
      await fs.mkdir(validationDir, { recursive: true });

      const validationFile = path.join(validationDir, `${validation.id}.json`);
      await fs.writeFile(validationFile, JSON.stringify(validation, null, 2));
    } catch (error) {
      console.error('Failed to store validation results:', error);
    }
  }

  /**
   * Update risk metrics
   */
  updateRiskMetrics(validation) {
    this.riskMetrics.totalValidations++;

    if (validation.status === 'APPROVED') {
      this.riskMetrics.passedValidations++;
    } else {
      this.riskMetrics.failedValidations++;
    }

    if (validation.summary.riskScore) {
      const totalRisk = this.riskMetrics.averageRiskScore * (this.riskMetrics.totalValidations - 1);
      this.riskMetrics.averageRiskScore =
        (totalRisk + validation.summary.riskScore) / this.riskMetrics.totalValidations;
    }
  }

  /**
   * Shuffle array for Monte Carlo
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics() {
    return {
      ...this.riskMetrics,
      recentValidations: this.validationHistory.slice(-10),
      approvalRate: this.riskMetrics.totalValidations > 0
        ? (this.riskMetrics.passedValidations / this.riskMetrics.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = StrategyValidator;