#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Load superpowers configuration - essential for tool definitions and capabilities
const superpowers = require('./algotrade.json');

class AlgoTradeSuperpowersServer {
  constructor() {
    this.server = new Server(
      {
        name: 'AlgoTrade Superpowers',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      
      // Frontend tools
      tools.push({
        name: 'create_trading_dashboard',
        description: 'Create a React trading dashboard with TypeScript and real-time charts',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            framework: { type: 'string', enum: ['react', 'vue'], description: 'Frontend framework' },
            charting: { type: 'string', enum: ['tradingview', 'chartjs', 'd3'], description: 'Charting library' },
            realtime: { type: 'boolean', description: 'Enable real-time data' }
          },
          required: ['name', 'framework']
        }
      });

      // Backend tools
      tools.push({
        name: 'create_trading_api',
        description: 'Create Node.js API for trading platform',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'API name' },
            framework: { type: 'string', enum: ['express', 'fastify'], description: 'Backend framework' },
            websocket: { type: 'boolean', description: 'Enable WebSocket support' },
            database: { type: 'string', enum: ['mongodb', 'influxdb', 'postgres'], description: 'Database type' }
          },
          required: ['name', 'framework']
        }
      });

      // Database tools
      tools.push({
        name: 'setup_database',
        description: 'Setup database for trading data',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mongodb', 'influxdb', 'timescaledb'], description: 'Database type' },
            name: { type: 'string', description: 'Database name' },
            collections: { type: 'array', items: { type: 'string' }, description: 'Collections/tables' }
          },
          required: ['type', 'name']
        }
      });

      // Trading tools
      tools.push({
        name: 'connect_exchange',
        description: 'Connect to cryptocurrency exchange',
        inputSchema: {
          type: 'object',
          properties: {
            exchange: { type: 'string', enum: ['binance', 'coinbase', 'kraken'], description: 'Exchange name' },
            env_file: { type: 'string', description: 'Environment file path for API keys' },
            sandbox: { type: 'boolean', description: 'Use sandbox/testnet' }
          },
          required: ['exchange']
        }
      });

      // AI/ML tools
      tools.push({
        name: 'create_trading_model',
        description: 'Create ML model for trading predictions',
        inputSchema: {
          type: 'object',
          properties: {
            algorithm: { type: 'string', enum: ['lstm', 'random_forest', 'xgboost', 'svm'], description: 'ML algorithm' },
            features: { type: 'array', items: { type: 'string' }, description: 'Input features' },
            target: { type: 'string', description: 'Target variable' },
            timeframe: { type: 'string', description: 'Timeframe for prediction' }
          },
          required: ['algorithm', 'features', 'target']
        }
      });

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_trading_dashboard':
            return await this.createTradingDashboard(args);
          case 'create_trading_api':
            return await this.createTradingAPI(args);
          case 'setup_database':
            return await this.setupDatabase(args);
          case 'connect_exchange':
            return await this.connectExchange(args);
          case 'create_trading_model':
            return await this.createTradingModel(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async createTradingDashboard(args) {
    const { name, framework, charting = 'tradingview', realtime = true } = args;
    
    const commands = [];
    const dependencies = framework === 'react' 
      ? ['react', 'react-dom', 'typescript', '@types/react', '@types/react-dom']
      : ['vue', '@vue/cli-plugin-typescript'];

    if (charting === 'tradingview') {
      dependencies.push('tradingview-widget');
    } else if (charting === 'chartjs') {
      dependencies.push('chart.js', 'react-chartjs-2');
    }

    if (realtime) {
      dependencies.push('socket.io-client');
    }

    commands.push(`npx create-${framework}-app ${name} --template typescript`);
    commands.push(`cd ${name} && npm install ${dependencies.join(' ')}`);

    return {
      content: [
        {
          type: 'text',
          text: `Creating ${framework} trading dashboard "${name}" with ${charting} charts...\n\nCommands to run:\n${commands.join('\n')}\n\nFeatures: ${realtime ? 'Real-time data' : 'Static data'}, ${charting} charting, TypeScript support`
        }
      ]
    };
  }

  async createTradingAPI(args) {
    const { name, framework, websocket = true, database = 'mongodb' } = args;
    
    const dependencies = [framework];
    if (websocket) {
      dependencies.push('socket.io');
    }
    if (database === 'mongodb') {
      dependencies.push('mongoose');
    } else if (database === 'influxdb') {
      dependencies.push('influx');
    }

    dependencies.push('cors', 'helmet', 'dotenv', 'joi');

    return {
      content: [
        {
          type: 'text',
          text: `Creating ${framework} API "${name}" with ${database} database...\n\nDependencies: ${dependencies.join(', ')}\n\nFeatures: ${websocket ? 'WebSocket support' : 'REST only'}, ${database} integration, security middleware`
        }
      ]
    };
  }

  async setupDatabase(args) {
    const { type, name, collections } = args;
    
    let config;
    if (type === 'mongodb') {
      config = {
        connection: `mongodb://localhost:27017/${name}`,
        collections: collections || ['trades', 'orders', 'balances', 'strategies']
      };
    } else if (type === 'influxdb') {
      config = {
        connection: `http://localhost:8086/${name}`,
        measurements: collections || ['price', 'volume', 'indicators']
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Setting up ${type} database "${name}"...\n\nConfig: ${JSON.stringify(config, null, 2)}`
        }
      ]
    };
  }

  async connectExchange(args) {
    const { exchange, env_file, sandbox = true } = args;
    
    return {
      content: [
        {
          type: 'text',
          text: `Connecting to ${exchange} exchange in ${sandbox ? 'sandbox' : 'production'} mode...\n\nEnvironment file: ${env_file || '.env'}\n\nRequired env variables:\n- ${exchange.toUpperCase()}_API_KEY\n- ${exchange.toUpperCase()}_API_SECRET\n- ${exchange.toUpperCase()}_PASSPHRASE (if required)`
        }
      ]
    };
  }

  async createTradingModel(args) {
    const { algorithm, features, target, timeframe = '1h' } = args;
    
    const dependencies = algorithm === 'lstm' 
      ? ['tensorflow', '@tensorflow/tfjs-node']
      : algorithm === 'xgboost' 
        ? ['xgboost']
        : ['scikit-learn'];

    dependencies.push('pandas', 'numpy', 'talib', 'matplotlib');

    return {
      content: [
        {
          type: 'text',
          text: `Creating ${algorithm} trading model...\n\nFeatures: ${features.join(', ')}\nTarget: ${target}\nTimeframe: ${timeframe}\n\nDependencies: ${dependencies.join(', ')}\n\nModel pipeline ready for backtesting and deployment.`
        }
      ]
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AlgoTrade Superpowers MCP server running on stdio');
  }
}

if (require.main === module) {
  const server = new AlgoTradeSuperpowersServer();
  server.run().catch(console.error);
}

module.exports = AlgoTradeSuperpowersServer;