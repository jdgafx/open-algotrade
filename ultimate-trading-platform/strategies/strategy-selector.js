/**
 * STRATEGY SELECTOR - INTUITIVE CHOICE GUIDE
 * Helps users choose the right strategy based on their goals
 *
 * This guide makes it easy for anyone to pick a strategy based on:
 * 1. How much money they want to make (profit target)
 * 2. How fast they want to make it (timeframe)
 * 3. Their risk tolerance
 * 4. Current market conditions
 */

class StrategySelector {
  constructor() {
    this.strategies = {
      'turtle-trading': {
        name: 'Turtle Trading',
        profitTarget: '0.2% per trade',
        speed: 'Medium',
        riskLevel: 'Medium',
        bestMarket: 'Trending',
        timeframes: ['5m', '15m', '1h', '4h'],
        description: 'Classic trend-following. Reliable and consistent.',
        whoShouldUse: 'Beginners, steady growth, trending markets',
        minAccount: '$100',
        expectedTradesPerDay: '5-10'
      },
      'consolidation-pop': {
        name: 'Consolidation Pop',
        profitTarget: '0.3% per trade',
        speed: 'Fast',
        riskLevel: 'Low-Medium',
        bestMarket: 'Ranging',
        timeframes: ['1m', '3m', '5m', '15m'],
        description: 'Quick profits from consolidation breakouts.',
        whoShouldUse: 'Active traders, choppy markets, quick wins',
        minAccount: '$50',
        expectedTradesPerDay: '15-30'
      },
      'correlation-arbitrage': {
        name: 'Correlation Arbitrage',
        profitTarget: '0.25% per trade',
        speed: 'Medium-Fast',
        riskLevel: 'Medium',
        bestMarket: 'Volatile Altcoins',
        timeframes: ['1m', '3m', '5m', '15m'],
        description: 'Catches altcoin moves when ETH breaks out.',
        whoShouldUse: 'Altcoin traders, volatile markets',
        minAccount: '$75',
        expectedTradesPerDay: '10-20'
      },
      'bollinger-squeeze': {
        name: 'Bollinger Squeeze',
        profitTarget: '0.5% per trade',
        speed: 'Medium',
        riskLevel: 'Medium-High',
        bestMarket: 'Trending/Volatile',
        timeframes: ['5m', '15m', '1h', '4h'],
        description: 'Catches big moves from low volatility periods.',
        whoShouldUse: 'Aggressive traders, high reward seekers',
        minAccount: '$150',
        expectedTradesPerDay: '3-8'
      },
      'rsi-divergence': {
        name: 'RSI Divergence',
        profitTarget: '0.4% per trade',
        speed: 'Slow-Medium',
        riskLevel: 'Medium',
        bestMarket: 'Ranging/Reversal',
        timeframes: ['15m', '1h', '4h'],
        description: 'Trades momentum reversals early.',
        whoShouldUse: 'Patient traders, reversal hunters',
        minAccount: '$100',
        expectedTradesPerDay: '2-5'
      }
    };
  }

  /**
   * Get strategy recommendations based on user goals
   */
  getRecommendations(userGoals) {
    const {
      profitTarget = 'any',
      speed = 'any',
      riskTolerance = 'medium',
      marketCondition = 'any',
      accountSize = 100
    } = userGoals;

    let scores = [];

    for (const [id, strategy] of Object.entries(this.strategies)) {
      let score = 0;

      // Score based on profit target
      if (profitTarget === 'quick-small') {
        if (strategy.profitTarget === '0.2% per trade' || strategy.profitTarget === '0.25% per trade') {
          score += 30;
        } else if (strategy.profitTarget === '0.3% per trade') {
          score += 40;
        } else if (strategy.profitTarget === '0.4% per trade' || strategy.profitTarget === '0.5% per trade') {
          score += 20;
        }
      } else if (profitTarget === 'moderate') {
        if (strategy.profitTarget === '0.3% per trade' || strategy.profitTarget === '0.4% per trade') {
          score += 40;
        } else if (strategy.profitTarget === '0.25% per trade' || strategy.profitTarget === '0.5% per trade') {
          score += 30;
        } else {
          score += 20;
        }
      } else if (profitTarget === 'big') {
        if (strategy.profitTarget === '0.5% per trade') {
          score += 40;
        } else if (strategy.profitTarget === '0.4% per trade') {
          score += 30;
        } else {
          score += 15;
        }
      }

      // Score based on speed
      if (speed === 'very-fast' && strategy.speed.includes('Fast')) score += 30;
      else if (speed === 'fast' && (strategy.speed.includes('Fast') || strategy.speed.includes('Medium'))) score += 25;
      else if (speed === 'medium' && strategy.speed.includes('Medium')) score += 30;
      else if (speed === 'slow' && strategy.speed.includes('Slow')) score += 30;

      // Score based on risk tolerance
      if (riskTolerance === 'low' && strategy.riskLevel.includes('Low')) score += 30;
      else if (riskTolerance === 'medium' && strategy.riskLevel.includes('Medium')) score += 30;
      else if (riskTolerance === 'high' && strategy.riskLevel.includes('High')) score += 30;

      // Score based on market condition
      if (marketCondition !== 'any' && strategy.bestMarket.toLowerCase().includes(marketCondition.toLowerCase())) {
        score += 40;
      }

      // Score based on account size
      const minAccountValue = parseInt(strategy.minAccount.replace('$', ''));
      if (accountSize >= minAccountValue) {
        score += 20;
      }

      scores.push({
        id,
        strategy,
        score,
        match: score >= 70 ? 'Excellent' : score >= 50 ? 'Good' : score >= 30 ? 'Fair' : 'Poor'
      });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  /**
   * Get quick recommendation based on common scenarios
   */
  getQuickRecommendation(scenario) {
    const scenarios = {
      'beginner': {
        title: '👶 Beginner Recommendation',
        description: 'You\'re new to trading. Start with these safe, proven strategies.',
        recommendations: ['turtle-trading', 'consolidation-pop'],
        reason: 'Simple logic, clear signals, lower risk.'
      },
      'want-money-fast': {
        title: '⚡ Quick Money Strategy',
        description: 'You want to make profits fast. These strategies trade frequently.',
        recommendations: ['consolidation-pop', 'correlation-arbitrage'],
        reason: 'Multiple trades per day, quick exits.'
      },
      'big-profit': {
        title: '💰 Big Profit Hunter',
        description: 'You\'re after bigger gains. These strategies have higher profit targets.',
        recommendations: ['bollinger-squeeze', 'rsi-divergence'],
        reason: 'Higher reward potential per trade.'
      },
      'low-risk': {
        title: '🛡️ Safe & Steady',
        description: 'You prefer lower risk strategies with consistent returns.',
        recommendations: ['turtle-trading', 'consolidation-pop'],
        reason: 'Lower drawdowns, more predictable outcomes.'
      },
      'volatile-market': {
        title: '📈 Volatile Market Master',
        description: 'You thrive in chaotic, fast-moving markets.',
        recommendations: ['correlation-arbitrage', 'bollinger-squeeze'],
        reason: 'Designed for high volatility environments.'
      }
    };

    return scenarios[scenario] || null;
  }

  /**
   * Get all strategies for display
   */
  getAllStrategies() {
    return this.strategies;
  }

  /**
   * Get single strategy by ID
   */
  getStrategy(id) {
    return this.strategies[id] || null;
  }

  /**
   * Get strategy comparison table
   */
  getComparisonTable() {
    const comparison = [];

    for (const [id, strategy] of Object.entries(this.strategies)) {
      comparison.push({
        Strategy: strategy.name,
        'Profit/Trade': strategy.profitTarget,
        Speed: strategy.speed,
        Risk: strategy.riskLevel,
        'Best Market': strategy.bestMarket,
        'Min Account': strategy.minAccount,
        'Trades/Day': strategy.expectedTradesPerDay
      });
    }

    return comparison;
  }
}

export default StrategySelector;
