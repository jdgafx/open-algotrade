#!/usr/bin/env node

/**
 * 🚀 MCP Auto-Coordinator
 *
 * Automatically coordinates multiple MCP servers for complex tasks
 * Ensures liberal and frequent MCP usage
 */

const { IntelligentMCPOrchestrator } = require('./intelligent_mcp_orchestrator');

class MCPAutoCoordinator {
  constructor() {
    this.orchestrator = new IntelligentMCPOrchestrator();
    this.activeSwarms = new Map();
    this.usageStats = {
      totalTasks: 0,
      mcpUsage: new Map(),
      successRate: new Map()
    };
  }

  /**
   * 🎯 Analyze Task and Route to Best MCP Servers
   */
  async routeTask(task, options = {}) {
    this.usageStats.totalTasks++;

    console.log(`\n🚀 Routing Task: "${task}"`);

    // Get intelligent selection
    const plan = this.orchestrator.generateOrchestrationPlan(task);

    // Execute based on task complexity
    if (options.complex || plan.orchestration_steps.length > 2) {
      return await this.handleComplexTask(plan, options);
    } else {
      return await this.handleSimpleTask(plan, options);
    }
  }

  /**
   * 🎯 Handle Simple Tasks (Single MCP)
   */
  async handleSimpleTask(plan, options) {
    const { primary_server, confidence } = plan;

    console.log(`✅ Simple Task - Using ${primary_server} (${(confidence * 100).toFixed(1)}% confidence)`);

    // Log MCP usage
    this.logMCPUsage(primary_server);

    // Return execution plan
    return {
      type: 'simple',
      mcp_server: primary_server,
      confidence: confidence,
      command: this.getExecutionCommand(plan),
      immediate_execution: true
    };
  }

  /**
   * 🎯 Handle Complex Tasks (Multi-MCP Coordination)
   */
  async handleComplexTask(plan, options) {
    console.log(`🎯 Complex Task - Multi-MCP Coordination Required`);

    // Initialize swarm coordination
    await this.initializeCoordination();

    // Chain multiple MCP servers
    const executionChain = await this.createExecutionChain(plan, options);

    console.log(`\n📋 Execution Chain:`);
    executionChain.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step.mcp_server} → ${step.action}`);
    });

    this.logMCPUsage(plan.primary_server);
    plan.alternatives.forEach(alt => this.logMCPUsage(alt.server));

    return {
      type: 'complex',
      coordination_required: true,
      execution_chain: executionChain,
      swarm_id: this.getActiveSwarmId()
    };
  }

  /**
   * 🔄 Initialize MCP Coordination
   */
  async initializeCoordination() {
    const swarmId = `swarm-${Date.now()}`;

    // Use claude-flow for coordination
    console.log(`\n🔧 Initializing coordination via claude-flow...`);
    this.activeSwarms.set(swarmId, {
      status: 'initializing',
      created: new Date(),
      agents: []
    });

    return swarmId;
  }

  /**
   * ⛓️ Create Execution Chain
   */
  async createExecutionChain(plan, options) {
    const chain = {
      steps: [],
      parallel_execution: options.parallel || false
    };

    // Step 1: Setup coordination
    chain.steps.push({
      mcp_server: 'claude-flow',
      action: 'initialize_coordination',
      command: 'mcp__claude-flow__swarm_init',
      params: { topology: 'mesh', maxAgents: 5 }
    });

    // Step 2: Primary execution
    chain.steps.push({
      mcp_server: plan.primary_server,
      action: 'primary_execution',
      command: this.orchestrator.getMCPCommand(plan.primary_server, plan.task),
      params: this.orchestrator.getMCPParams(plan.primary_server, plan.task)
    });

    // Step 3: Parallel alternatives (if enabled)
    if (options.parallel && plan.alternatives.length > 0) {
      plan.alternatives.forEach(alt => {
        chain.steps.push({
          mcp_server: alt.server,
          action: 'parallel_validation',
          command: this.orchestrator.getMCPCommand(alt.server, plan.task),
          params: this.orchestrator.getMCPParams(alt.server, plan.task)
        });
      });
    }

    // Step 4: Synthesis/Aggregation
    chain.steps.push({
      mcp_server: 'claude-flow',
      action: 'aggregate_results',
      command: 'mcp__claude-flow__task_orchestrate',
      params: { task: `Aggregate results from: ${plan.task}`, strategy: 'adaptive' }
    });

    return chain;
  }

  /**
   * 📊 Log MCP Usage
   */
  logMCPUsage(server) {
    const current = this.usageStats.mcpUsage.get(server) || 0;
    this.usageStats.mcpUsage.set(server, current + 1);
  }

  /**
   * 📈 Get Usage Statistics
   */
  getUsageStats() {
    const stats = {
      total_tasks: this.usageStats.totalTasks,
      mcp_usage: Object.fromEntries(this.usageStats.mcpUsage),
      active_swarms: this.activeSwarms.size,
      mcp_servers_used: this.usageStats.mcpUsage.size
    };

    return stats;
  }

  /**
   * 🎮 Get Active Swarm ID
   */
  getActiveSwarmId() {
    if (this.activeSwarms.size > 0) {
      return Array.from(this.activeSwarms.keys())[0];
    }
    return null;
  }

  /**
   * 🧠 Proactive MCP Suggestion
   */
  suggestMCPs(context) {
    const suggestions = [];

    // Analyze context and suggest MCP servers
    if (context.includes('research') || context.includes('search')) {
      suggestions.push({
        mcp: 'web-search-prime',
        reason: 'Proactive web search engagement',
        confidence: 0.9
      });
    }

    if (context.includes('coordinate') || context.includes('orchestrate')) {
      suggestions.push({
        mcp: 'claude-flow',
        reason: 'Proactive agent coordination',
        confidence: 0.95
      });

      suggestions.push({
        mcp: 'ruv-swarm',
        reason: 'Enhanced coordination needed',
        confidence: 0.85
      });
    }

    if (context.includes('cloud') || context.includes('deploy')) {
      suggestions.push({
        mcp: 'flow-nexus',
        reason: 'Proactive cloud execution',
        confidence: 0.95
      });
    }

    if (context.includes('file') || context.includes('read') || context.includes('write')) {
      suggestions.push({
        mcp: 'filesystem',
        reason: 'Proactive file operation',
        confidence: 0.95
      });
    }

    return suggestions;
  }

  /**
   * 🎯 Auto-Execute with Monitoring
   */
  async autoExecute(task, options = {}) {
    console.log(`\n🧠 AUTO-EXECUTING WITH MCP ORCHESTRATION`);
    console.log(`Task: ${task}\n`);

    const result = await this.routeTask(task, options);

    // Show proactive suggestions
    const suggestions = this.suggestMCPs(task);
    if (suggestions.length > 0) {
      console.log(`\n💡 Proactive MCP Suggestions:`);
      suggestions.forEach(s => {
        console.log(`   • ${s.mcp} (${(s.confidence * 100).toFixed(0)}%) - ${s.reason}`);
      });
    }

    // Show usage stats
    console.log(`\n📊 Current MCP Usage:`);
    const stats = this.getUsageStats();
    Object.entries(stats.mcp_usage).forEach(([server, count]) => {
      console.log(`   ${server}: ${count} uses`);
    });

    console.log(`\n✅ Total Tasks Processed: ${stats.total_tasks}`);
    console.log(`   Active Swarms: ${stats.active_swarms}`);
    console.log(`   MCP Servers Used: ${stats.mcp_servers_used}\n`);

    return result;
  }
}

module.exports = { MCPAutoCoordinator };

// CLI Usage
if (require.main === module) {
  const coordinator = new MCPAutoCoordinator();
  const task = process.argv[2] || 'Build a comprehensive trading bot';
  coordinator.autoExecute(task);
}
