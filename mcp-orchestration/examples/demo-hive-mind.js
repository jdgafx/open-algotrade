#!/usr/bin/env node

/**
 * 🚀 MCP Hive Mind Demo
 *
 * Demonstrates the hyper-intelligent MCP orchestration system
 * in action with multiple concurrent tasks
 */

const { MCPHiveMindCoordinator } = require('../systems/mcp-hive-mind-coordinator');
const { MCPUsageMonitor } = require('../systems/mcp-usage-monitor');

async function runDemo() {
  console.log(`\n🚀 MCP HYPER-INTELLIGENT SYSTEM DEMO`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Demonstrating liberal and frequent MCP server usage\n`);

  const hiveMind = new MCPHiveMindCoordinator();
  const monitor = new MCPUsageMonitor();

  // Demo tasks showcasing different MCP servers
  const demoTasks = [
    {
      task: "Research algorithmic trading strategies",
      type: "research",
      expectedMCPs: ["web-search-prime", "context7", "sequential-thinking"]
    },
    {
      task: "Build a REST API for trading data",
      type: "development",
      expectedMCPs: ["claude-flow", "filesystem", "flow-nexus"]
    },
    {
      task: "Analyze market data patterns",
      type: "analysis",
      expectedMCPs: ["sequential-thinking", "claude-flow", "ruv-swarm"]
    },
    {
      task: "Create visual dashboard for trading",
      type: "visual",
      expectedMCPs: ["zai-mcp-server", "browser", "filesystem"]
    },
    {
      task: "Set up automated trading workflow",
      type: "automation",
      expectedMCPs: ["zapier", "flow-nexus", "claude-flow"]
    }
  ];

  console.log(`📋 Demo Tasks (${demoTasks.length}):`);
  demoTasks.forEach((task, i) => {
    console.log(`   ${i + 1}. [${task.type}] ${task.task}`);
  });

  console.log(`\n🎯 Executing with Queen-Led Coordination...\n`);

  // Execute all tasks
  const results = [];
  for (let i = 0; i < demoTasks.length; i++) {
    const task = demoTasks[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TASK ${i + 1}/${demoTasks.length}: ${task.task}`);
    console.log('='.repeat(60));

    const result = await hiveMind.executeQueenDirective(task.task, {
      complex: true,
      parallel: i % 2 === 0 // Parallel for even tasks
    });

    results.push({
      task: task.task,
      type: task.type,
      result: result
    });

    // Simulate usage monitoring
    const primaryMCP = result.decision.mcp_server || result.execution.mcp_server;
    monitor.recordOperation(primaryMCP, task.type, Math.random() * 2000 + 500, true);

    console.log(`\n✅ Task ${i + 1} completed`);
  }

  // Show final summary
  console.log(`\n\n🎉 DEMO COMPLETE - FINAL SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  console.log(`📊 MCP Server Usage:`);
  const usageStats = monitor.generateReport();
  Object.entries(usageStats.mcp_server_usage).forEach(([server, stats]) => {
    const bar = '█'.repeat(Math.min(stats.operations, 20));
    console.log(`   ${server.padEnd(20)} ${bar} ${stats.operations}`);
  });

  console.log(`\n🐝 Hive Mind Status:`);
  const hiveStatus = hiveMind.getHiveMindStatus();
  console.log(`   Workers: ${hiveStatus.workers.active}/${hiveStatus.workers.total} active`);
  console.log(`   Directives: ${hiveStatus.queen.directives_issued}`);
  console.log(`   MCP Servers: ${hiveStatus.mcp_servers.available} available`);

  console.log(`\n💡 Task Results Summary:`);
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.type.padEnd(12)} → ${r.task.substring(0, 50)}...`);
  });

  console.log(`\n✅ ALL MCP SERVERS ACTIVELY UTILIZED`);
  console.log(`   System running with collective intelligence!\n`);
}

runDemo().catch(console.error);
