#!/usr/bin/env node

/**
 * 📊 MCP Usage Monitor
 *
 * Continuously monitors and reports MCP server usage
 * Ensures maximum utilization of all available MCP servers
 */

class MCPUsageMonitor {
  constructor() {
    this.metrics = {
      totalOperations: 0,
      mcpServerUsage: new Map(),
      taskCategories: new Map(),
      responseTimes: new Map(),
      successRates: new Map(),
      lastActivity: new Map()
    };

    this.thresholds = {
      mcpServerUnderutilization: 5, // operations
      slowResponseThreshold: 5000, // ms
      lowSuccessRateThreshold: 0.7
    };
  }

  /**
   * 📈 Record MCP Server Operation
   */
  recordOperation(server, taskType, responseTime, success = true) {
    this.metrics.totalOperations++;

    // Update server usage
    const currentUsage = this.metrics.mcpServerUsage.get(server) || 0;
    this.metrics.mcpServerUsage.set(server, currentUsage + 1);

    // Update task category
    const categoryCount = this.metrics.taskCategories.get(taskType) || 0;
    this.metrics.taskCategories.set(taskType, categoryCount + 1);

    // Update response time
    this.metrics.responseTimes.set(server, responseTime);

    // Update success rate
    const currentSuccess = this.metrics.successRates.get(server) || { success: 0, total: 0 };
    currentSuccess.total++;
    if (success) currentSuccess.success++;
    this.metrics.successRates.set(server, currentSuccess);

    // Update last activity
    this.metrics.lastActivity.set(server, new Date());

    // Check for issues
    this.checkForIssues(server);
  }

  /**
   * 🚨 Check for Issues
   */
  checkForIssues(server) {
    const usage = this.metrics.mcpServerUsage.get(server) || 0;
    const success = this.metrics.successRates.get(server);
    const responseTime = this.metrics.responseTimes.get(server);

    const issues = [];

    // Check for underutilization
    if (usage < this.thresholds.mcpServerUnderutilization) {
      issues.push({
        type: 'underutilization',
        server: server,
        message: `${server} is underutilized (${usage} operations)`,
        recommendation: `Increase usage of ${server} for relevant tasks`
      });
    }

    // Check for slow response
    if (responseTime > this.thresholds.slowResponseThreshold) {
      issues.push({
        type: 'slow_response',
        server: server,
        message: `${server} has slow response time (${responseTime}ms)`,
        recommendation: `Consider optimizing or switching to alternative MCP`
      });
    }

    // Check for low success rate
    if (success && success.total > 5) {
      const rate = success.success / success.total;
      if (rate < this.thresholds.lowSuccessRateThreshold) {
        issues.push({
          type: 'low_success_rate',
          server: server,
          message: `${server} has low success rate (${(rate * 100).toFixed(1)}%)`,
          recommendation: `Review ${server} usage or try alternatives`
        });
      }
    }

    return issues;
  }

  /**
   * 📊 Generate Usage Report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_operations: this.metrics.totalOperations,
        active_mcp_servers: this.metrics.mcpServerUsage.size,
        task_categories: this.metrics.taskCategories.size
      },
      mcp_server_usage: {},
      recommendations: []
    };

    // Server usage details
    for (const [server, usage] of this.metrics.mcpServerUsage.entries()) {
      const success = this.metrics.successRates.get(server);
      const responseTime = this.metrics.responseTimes.get(server);
      const lastActivity = this.metrics.lastActivity.get(server);

      report.mcp_server_usage[server] = {
        operations: usage,
        success_rate: success ? (success.success / success.total) : null,
        avg_response_time: responseTime || null,
        last_activity: lastActivity ? lastActivity.toISOString() : null
      };

      // Generate recommendations
      const issues = this.checkForIssues(server);
      report.recommendations.push(...issues.map(issue => ({
        priority: issue.type === 'underutilization' ? 'low' : 'medium',
        ...issue
      })));
    }

    // Sort recommendations by priority
    report.recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return report;
  }

  /**
   * 🎯 Get Utilization Status
   */
  getUtilizationStatus() {
    const status = {
      highly_utilized: [],
      moderately_utilized: [],
      underutilized: [],
      inactive: []
    };

    for (const [server, usage] of this.metrics.mcpServerUsage.entries()) {
      if (usage > 20) {
        status.highly_utilized.push(server);
      } else if (usage > 5) {
        status.moderately_utilized.push(server);
      } else {
        status.underutilized.push(server);
      }
    }

    return status;
  }

  /**
   * 🚀 Suggest Next Best MCP
   */
  suggestNextMCP(taskType, currentTask) {
    const suggestions = [];

    // Analyze task and suggest MCP servers
    const task = currentTask.toLowerCase();

    // Always suggest claude-flow for development tasks
    if (task.includes('develop') || task.includes('build') || task.includes('create')) {
      suggestions.push({
        mcp_server: 'claude-flow',
        reason: 'Primary development orchestrator',
        confidence: 0.95
      });
    }

    // Suggest specialized MCPs based on task
    if (task.includes('research') || task.includes('search')) {
      suggestions.push({
        mcp_server: 'web-search-prime',
        reason: 'Web research specialist',
        confidence: 0.9
      });
    }

    if (task.includes('visual') || task.includes('image')) {
      suggestions.push({
        mcp_server: 'zai-mcp-server',
        reason: 'Visual analysis specialist',
        confidence: 0.9
      });
    }

    if (task.includes('file') || task.includes('read') || task.includes('write')) {
      suggestions.push({
        mcp_server: 'filesystem',
        reason: 'Direct file system access',
        confidence: 0.95
      });
    }

    return suggestions;
  }

  /**
   * 📊 Print Dashboard
   */
  printDashboard() {
    const report = this.generateReport();
    const status = this.getUtilizationStatus();

    console.log(`\n📊 MCP USAGE DASHBOARD`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`\n📈 Summary:`);
    console.log(`   Total Operations: ${report.summary.total_operations}`);
    console.log(`   Active MCP Servers: ${report.summary.active_mcp_servers}`);
    console.log(`   Task Categories: ${report.summary.task_categories}`);

    console.log(`\n🎯 Utilization Status:`);
    console.log(`   Highly Utilized: ${status.highly_utilized.length} servers`);
    if (status.highly_utilized.length > 0) {
      console.log(`      ${status.highly_utilized.join(', ')}`);
    }

    console.log(`   Moderately Utilized: ${status.moderately_utilized.length} servers`);
    if (status.moderately_utilized.length > 0) {
      console.log(`      ${status.moderately_utilized.join(', ')}`);
    }

    console.log(`   Underutilized: ${status.underutilized.length} servers`);
    if (status.underutilized.length > 0) {
      console.log(`      ${status.underutilized.join(', ')}`);
    }

    console.log(`\n🔧 Server Details:`);
    for (const [server, details] of Object.entries(report.mcp_server_usage)) {
      const successRate = details.success_rate ?
        `${(details.success_rate * 100).toFixed(1)}%` : 'N/A';
      const responseTime = details.avg_response_time ?
        `${details.avg_response_time}ms` : 'N/A';

      console.log(`\n   ${server}:`);
      console.log(`      Operations: ${details.operations}`);
      console.log(`      Success Rate: ${successRate}`);
      console.log(`      Avg Response: ${responseTime}`);
      console.log(`      Last Activity: ${details.last_activity || 'Never'}`);
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => {
        console.log(`   [${rec.priority.toUpperCase()}] ${rec.server}`);
        console.log(`      ${rec.message}`);
        console.log(`      → ${rec.recommendation}\n`);
      });
    }

    console.log(`\n🚀 Suggested Actions:`);
    status.underutilized.forEach(server => {
      console.log(`   • Increase usage of ${server}`);
    });
    console.log('');
  }

  /**
   * 🔄 Auto-Monitor
   */
  startMonitoring(intervalMs = 60000) {
    console.log(`\n🔄 Starting MCP Usage Monitor...`);
    console.log(`   Interval: ${intervalMs / 1000}s`);
    console.log(`   Checking for underutilization...\n`);

    setInterval(() => {
      const report = this.generateReport();
      const status = this.getUtilizationStatus();

      // Alert on underutilization
      if (status.underutilized.length > 0) {
        console.log(`⚠️  Underutilized MCP Servers: ${status.underutilized.join(', ')}`);
        console.log(`   Suggesting increased usage...\n`);
      }
    }, intervalMs);
  }
}

module.exports = { MCPUsageMonitor };

// CLI Usage
if (require.main === module) {
  const monitor = new MCPUsageMonitor();
  monitor.printDashboard();
}
