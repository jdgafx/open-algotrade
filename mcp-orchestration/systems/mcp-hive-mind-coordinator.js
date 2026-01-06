#!/usr/bin/env node

/**
 * 👑 MCP Hive Mind Coordinator
 *
 * Queen-led hierarchical coordination of all MCP servers
 * Ensures collective intelligence and maximum utilization
 */

const { MCPAutoCoordinator } = require('./mcp-auto-coordinator');
const { MCPUsageMonitor } = require('./mcp-usage-monitor');
const { IntelligentMCPOrchestrator } = require('./intelligent_mcp_orchestrator');

class MCPHiveMindCoordinator {
  constructor() {
    this.queen = {
      id: `queen-${Date.now()}`,
      type: 'strategic',
      directives: [],
      worker_queues: new Map(),
      consensus_threshold: 0.6,
      memory: new Map()
    };

    this.workers = new Map();
    this.coordinator = new MCPAutoCoordinator();
    this.monitor = new MCPUsageMonitor();
    this.orchestrator = new IntelligentMCPOrchestrator();

    this.initializeWorkers();
  }

  /**
   * 👑 Initialize Hive Mind Workers
   */
  initializeWorkers() {
    const workerTypes = [
      'researcher', 'coder', 'analyst', 'tester',
      'architect', 'reviewer', 'optimizer', 'documenter'
    ];

    workerTypes.forEach(type => {
      this.workers.set(type, {
        id: `${type}-${Date.now()}`,
        type: type,
        status: 'idle',
        mcp_affinity: this.getMCPAffinity(type),
        tasks_completed: 0,
        success_rate: 0
      });
    });

    console.log(`\n👑 MCP Hive Mind Initialized`);
    console.log(`   Queen ID: ${this.queen.id}`);
    console.log(`   Worker Count: ${this.workers.size}`);
    console.log(`   Available MCP Servers: 12\n`);
  }

  /**
   * 🎯 Get MCP Affinity for Worker Type
   */
  getMCPAffinity(workerType) {
    const affinities = {
      researcher: ['web-search-prime', 'context7', 'claude-flow'],
      coder: ['claude-flow', 'filesystem', 'flow-nexus'],
      analyst: ['sequential-thinking', 'claude-flow', 'ruv-swarm'],
      tester: ['browser', 'filesystem', 'claude-flow'],
      architect: ['claude-flow', 'flow-nexus', 'ruv-swarm'],
      reviewer: ['claude-flow', 'context7', 'sequential-thinking'],
      optimizer: ['claude-flow', 'flow-nexus', 'mcp__claude-flow__neural_train'],
      documenter: ['context7', 'notion', 'filesystem']
    };

    return affinities[workerType] || ['claude-flow'];
  }

  /**
   * 👑 Queen Issues Directive
   */
  async issueDirective(task, options = {}) {
    console.log(`\n👑 QUEEN DIRECTIVE: "${task}"`);

    // Store in memory
    this.queen.memory.set(`directive-${Date.now()}`, {
      task: task,
      timestamp: new Date(),
      options: options
    });

    // Analyze task and route to best workers
    const workerAssignment = this.assignWorkers(task);

    console.log(`\n🐝 Worker Assignment:`);
    workerAssignment.forEach((worker, type) => {
      console.log(`   ${type} → ${worker.id}`);
      console.log(`      Preferred MCP: ${worker.mcp_affinity[0]}`);
    });

    // Execute with worker coordination
    const results = await this.executeWithWorkers(workerAssignment, task, options);

    return results;
  }

  /**
   * 🐝 Assign Workers to Task
   */
  assignWorkers(task) {
    const taskLower = task.toLowerCase();
    const assigned = new Map();

    // Always assign a coordinator
    assigned.set('coordinator', {
      id: 'coordinator-main',
      type: 'coordinator',
      mcp_affinity: ['claude-flow', 'ruv-swarm'],
      status: 'active'
    });

    // Assign based on task keywords
    if (taskLower.includes('research') || taskLower.includes('search')) {
      assigned.set('researcher', this.getBestWorker('researcher'));
    }

    if (taskLower.includes('build') || taskLower.includes('create') || taskLower.includes('develop')) {
      assigned.set('coder', this.getBestWorker('coder'));
      assigned.set('architect', this.getBestWorker('architect'));
    }

    if (taskLower.includes('test') || taskLower.includes('verify')) {
      assigned.set('tester', this.getBestWorker('tester'));
    }

    if (taskLower.includes('analyze') || taskLower.includes('review')) {
      assigned.set('analyst', this.getBestWorker('analyst'));
      assigned.set('reviewer', this.getBestWorker('reviewer'));
    }

    if (taskLower.includes('optimize') || taskLower.includes('improve')) {
      assigned.set('optimizer', this.getBestWorker('optimizer'));
    }

    if (taskLower.includes('document') || taskLower.includes('explain')) {
      assigned.set('documenter', this.getBestWorker('documenter'));
    }

    return assigned;
  }

  /**
   * 🎯 Get Best Available Worker
   */
  getBestWorker(type) {
    const worker = this.workers.get(type);
    if (worker && worker.status === 'idle') {
      worker.status = 'active';
      return worker;
    }
    return this.workers.get(type) || { id: 'default', type: type, mcp_affinity: ['claude-flow'] };
  }

  /**
   * ⚡ Execute with Worker Coordination
   */
  async executeWithWorkers(workers, task, options) {
    const executionPlan = {
      task: task,
      workers: Array.from(workers.values()),
      mcp_servers: [],
      steps: []
    };

    // Collect all MCP servers
    workers.forEach(worker => {
      worker.mcp_affinity.forEach(mcp => {
        if (!executionPlan.mcp_servers.includes(mcp)) {
          executionPlan.mcp_servers.push(mcp);
        }
      });
    });

    // Create execution steps
    executionPlan.steps.push({
      step: 1,
      action: 'initialize_coordination',
      mcp_server: 'claude-flow',
      workers: ['coordinator']
    });

    executionPlan.steps.push({
      step: 2,
      action: 'execute_primary',
      mcp_server: this.selectPrimaryMCP(executionPlan.mcp_servers, task),
      workers: Array.from(workers.keys())
    });

    // Add parallel execution if complex task
    if (options.parallel && workers.size > 1) {
      executionPlan.steps.push({
        step: 3,
        action: 'parallel_validation',
        mcp_server: 'multiple',
        workers: Array.from(workers.keys())
      });
    }

    executionPlan.steps.push({
      step: 4,
      action: 'aggregate_results',
      mcp_server: 'claude-flow',
      workers: ['coordinator', 'analyst']
    });

    console.log(`\n📋 Execution Plan:`);
    console.log(`   MCP Servers: ${executionPlan.mcp_servers.join(', ')}`);
    console.log(`   Steps: ${executionPlan.steps.length}`);

    executionPlan.steps.forEach(step => {
      console.log(`   ${step.step}. ${step.action} → ${step.mcp_server}`);
      console.log(`      Workers: ${step.workers.join(', ')}`);
    });

    return executionPlan;
  }

  /**
   * 🎯 Select Primary MCP Server
   */
  selectPrimaryMCP(servers, task) {
    // Use intelligent orchestrator to select best
    const plan = this.orchestrator.generateOrchestrationPlan(task);
    return plan.primary_server;
  }

  /**
   * 🧠 Collective Intelligence Decision Making
   */
  async collectiveDecision(task, options = {}) {
    console.log(`\n🧠 COLLECTIVE INTELLIGENCE DECISION`);

    // Get proposals from all relevant workers
    const proposals = this.getWorkerProposals(task);

    console.log(`\n📢 Worker Proposals:`);
    proposals.forEach(proposal => {
      console.log(`   ${proposal.worker}: ${proposal.mcp_server} (${(proposal.confidence * 100).toFixed(0)}%)`);
    });

    // Find consensus
    const consensus = this.findConsensus(proposals);

    if (consensus.agreement >= this.queen.consensus_threshold) {
      console.log(`\n✅ CONSENSUS ACHIEVED: ${(consensus.agreement * 100).toFixed(1)}%`);
      console.log(`   Decision: Use ${consensus.mcp_server}`);
      return {
        decision: 'consensus',
        mcp_server: consensus.mcp_server,
        agreement: consensus.agreement,
        proposals: proposals
      };
    } else {
      console.log(`\n⚠️  NO CONSENSUS: ${(consensus.agreement * 100).toFixed(1)}%`);
      console.log(`   Queen Making Executive Decision...`);
      return {
        decision: 'queen_override',
        mcp_server: this.queenDecision(task, proposals),
        agreement: consensus.agreement,
        proposals: proposals
      };
    }
  }

  /**
   * 💡 Get Worker Proposals
   */
  getWorkerProposals(task) {
    const proposals = [];

    this.workers.forEach(worker => {
      if (worker.status === 'active') {
        const plan = this.orchestrator.generateOrchestrationPlan(task);
        proposals.push({
          worker: worker.type,
          mcp_server: plan.primary_server,
          confidence: plan.primary_server === worker.mcp_affinity[0] ? 0.9 : 0.7,
          reason: `Worker ${worker.type} preference`
        });
      }
    });

    return proposals;
  }

  /**
   * 🤝 Find Consensus
   */
  findConsensus(proposals) {
    const votes = new Map();

    proposals.forEach(proposal => {
      const current = votes.get(proposal.mcp_server) || 0;
      votes.set(proposal.mcp_server, current + 1);
    });

    // Find most voted option
    let maxVotes = 0;
    let winner = null;
    votes.forEach((count, server) => {
      if (count > maxVotes) {
        maxVotes = count;
        winner = server;
      }
    });

    const agreement = maxVotes / proposals.length;

    return {
      mcp_server: winner,
      votes: maxVotes,
      total: proposals.length,
      agreement: agreement
    };
  }

  /**
   * 👑 Queen Decision
   */
  queenDecision(task, proposals) {
    // Queen uses her strategic capabilities to decide
    const plan = this.orchestrator.generateOrchestrationPlan(task);
    console.log(`   Queen Decision: ${plan.primary_server}`);
    console.log(`   Rationale: ${plan.reason}`);

    return plan.primary_server;
  }

  /**
   * 📊 Get Hive Mind Status
   */
  getHiveMindStatus() {
    const status = {
      queen: {
        id: this.queen.id,
        type: this.queen.type,
        directives_issued: this.queen.memory.size
      },
      workers: {
        total: this.workers.size,
        active: Array.from(this.workers.values()).filter(w => w.status === 'active').length,
        idle: Array.from(this.workers.values()).filter(w => w.status === 'idle').length
      },
      mcp_servers: {
        available: 12,
        connected: 12,
        underutilization_alerts: []
      },
      recent_activity: Array.from(this.queen.memory.entries()).slice(-5)
    };

    return status;
  }

  /**
   * 🚀 Execute Queen Directive
   */
  async executeQueenDirective(task, options = {}) {
    console.log(`\n🚀 EXECUTING QUEEN DIRECTIVE`);
    console.log(`═══════════════════════════════════════`);

    // Issue directive
    const directiveResult = await this.issueDirective(task, options);

    // Get collective intelligence decision
    const decisionResult = await this.collectiveDecision(task, options);

    // Execute with monitoring
    const executionResult = await this.coordinator.autoExecute(task, options);

    // Update worker status
    this.workers.forEach(worker => {
      if (worker.status === 'active') {
        worker.status = 'idle';
        worker.tasks_completed++;
      }
    });

    return {
      directive: directiveResult,
      decision: decisionResult,
      execution: executionResult,
      hive_status: this.getHiveMindStatus()
    };
  }
}

module.exports = { MCPHiveMindCoordinator };

// CLI Usage
if (require.main === module) {
  const hiveMind = new MCPHiveMindCoordinator();
  const task = process.argv[2] || 'Build a comprehensive algorithmic trading system';
  hiveMind.executeQueenDirective(task);
}
