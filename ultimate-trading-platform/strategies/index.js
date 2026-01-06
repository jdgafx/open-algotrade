/**
 * Trading Strategies Index
 * All strategies based on MoonDev's proven algorithms
 *
 * 8 Core Strategies:
 * 1. Turtle Trading - 0.2% profit, trending markets
 * 2. Consolidation Pop - 0.3% profit, ranging markets
 * 3. Correlation Arbitrage - 0.25% profit, altcoin markets
 * 4. Bollinger Squeeze - 0.5% profit, volatile markets
 * 5. RSI Divergence - 0.4% profit, reversal markets
 * 6. Nadarya Watson - 0.35% profit, advanced trending
 * 7. Market Maker - 0.4% profit, high frequency
 * 8. Mean Reversion - 0.9% profit, SMA-based
 */

// Import all strategies
import TurtleTradingStrategy from './turtle-trading.js';
import ConsolidationPopStrategy from './consolidation-pop.js';
import CorrelationArbitrageStrategy from './correlation-arbitrage.js';
import BollingerSqueezeStrategy from './bollinger-squeeze.js';
import RSIDivergenceStrategy from './rsi-divergence.js';
import NadaryaWatsonStrategy from './nadarya-watson.js';
import MarketMakerStrategy from './market-maker.js';
import MeanReversionStrategy from './mean-reversion.js';
import StrategySelector from './strategy-selector.js';

// Export all strategies as an object
export const strategies = {
  turtleTrading: TurtleTradingStrategy,
  consolidationPop: ConsolidationPopStrategy,
  correlationArbitrage: CorrelationArbitrageStrategy,
  bollingerSqueeze: BollingerSqueezeStrategy,
  rsiDivergence: RSIDivergenceStrategy,
  nadaryaWatson: NadaryaWatsonStrategy,
  marketMaker: MarketMakerStrategy,
  meanReversion: MeanReversionStrategy,
  strategySelector: StrategySelector
};

// Export default strategy configurations
export const strategyConfigs = {
  turtleTrading: {
    name: 'Turtle Trading',
    profitTarget: '0.2%',
    riskLevel: 'Medium',
    speed: 'Medium',
    marketType: 'Trending',
    timeframe: '1h',
    description: '55-period breakout system with ATR stop losses',
    whyChoose: [
      'Proven trend-following strategy',
      'Clear breakout signals',
      'Good for trending markets',
      'ATR-based dynamic stop losses'
    ]
  },
  consolidationPop: {
    name: 'Consolidation Pop',
    profitTarget: '0.3%',
    riskLevel: 'Low-Medium',
    speed: 'Medium',
    marketType: 'Ranging',
    timeframe: '15m',
    description: 'Range trading in thirds with consolidation detection',
    whyChoose: [
      'Excellent for sideways markets',
      'Low risk with tight ranges',
      'Clear entry and exit points',
      '0.7% consolidation threshold'
    ]
  },
  correlationArbitrage: {
    name: 'Correlation Arbitrage',
    profitTarget: '0.25%',
    riskLevel: 'Medium',
    speed: 'Medium',
    marketType: 'Altcoin',
    timeframe: '5m',
    description: 'ETH-based altcoin correlation trading',
    whyChoose: [
      'Diversified across altcoins',
      'Correlation-based signals',
      'Good for volatile alt markets',
      'Multiple coin support'
    ]
  },
  bollingerSqueeze: {
    name: 'Bollinger Squeeze',
    profitTarget: '0.5%',
    riskLevel: 'Medium-High',
    speed: 'Fast',
    marketType: 'Volatile',
    timeframe: '5m',
    description: 'Bollinger Band compression breakout detection',
    whyChoose: [
      'High profit potential (0.5%)',
      'Great for volatile markets',
      'Early breakout detection',
      'Popular technical indicator'
    ]
  },
  rsiDivergence: {
    name: 'RSI Divergence',
    profitTarget: '0.4%',
    riskLevel: 'Medium',
    speed: 'Medium',
    marketType: 'Reversal',
    timeframe: '1h',
    description: 'RSI-based divergence signal detection',
    whyChoose: [
      'Excellent for reversals',
      'Momentum divergence signals',
      'Good risk-reward ratio',
      'Works on multiple timeframes'
    ]
  },
  nadaryaWatson: {
    name: 'Nadarya Watson',
    profitTarget: '0.35%',
    riskLevel: 'Medium',
    speed: 'Medium',
    marketType: 'Trending',
    timeframe: '1h',
    description: 'Gaussian-weighted trend detection + Stochastic RSI',
    whyChoose: [
      'Advanced mathematical smoothing',
      'Combines trend + momentum',
      'Proven 300%+ backtests',
      'Catches reversals early'
    ]
  },
  marketMaker: {
    name: 'Market Maker',
    profitTarget: '0.4%',
    riskLevel: 'Medium-High',
    speed: 'Fast',
    marketType: 'Volatile',
    timeframe: '5m',
    description: 'Local high/low positioning with tight targets',
    whyChoose: [
      'High frequency opportunities',
      'Tight profit targets (0.4%)',
      'Built-in risk management',
      'Perfect for volatile markets'
    ]
  },
  meanReversion: {
    name: 'Mean Reversion',
    profitTarget: '0.9%',
    riskLevel: 'Medium',
    speed: 'Medium',
    marketType: 'Ranging',
    timeframe: '15m',
    description: 'SMA-based mean reversion across 75+ tickers',
    whyChoose: [
      'Proven across 75 cryptocurrencies',
      'Excellent for ranging markets',
      'Clear SMA-based signals',
      'Highest profit target (0.9%)'
    ]
  }
};

// Helper function to get strategy by profit target
export function getStrategiesByProfitTarget(minProfit, maxProfit) {
  const matched = [];
  for (const [key, config] of Object.entries(strategyConfigs)) {
    const profit = parseFloat(config.profitTarget);
    if (profit >= minProfit && profit <= maxProfit) {
      matched.push({ key, config });
    }
  }
  return matched;
}

// Helper function to get strategies by risk level
export function getStrategiesByRiskLevel(riskLevel) {
  const matched = [];
  for (const [key, config] of Object.entries(strategyConfigs)) {
    if (config.riskLevel === riskLevel) {
      matched.push({ key, config });
    }
  }
  return matched;
}

// Helper function to get strategies by market type
export function getStrategiesByMarketType(marketType) {
  const matched = [];
  for (const [key, config] of Object.entries(strategyConfigs)) {
    if (config.marketType === marketType) {
      matched.push({ key, config });
    }
  }
  return matched;
}

// Helper function to get strategy recommendations based on user goals
export function getRecommendations({ profitGoal, riskTolerance, marketType, speed }) {
  const selector = new StrategySelector();
  return selector.getRecommendations({
    profitGoal,
    riskTolerance,
    marketType,
    speed
  });
}

// Export all as default
export default {
  strategies,
  strategyConfigs,
  getStrategiesByProfitTarget,
  getStrategiesByRiskLevel,
  getStrategiesByMarketType,
  getRecommendations
};
