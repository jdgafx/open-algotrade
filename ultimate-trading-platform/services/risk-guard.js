class RiskGuard {
    constructor() {
        this.dailyLoss = 0;
        this.maxDrawdown = 0;
        this.openPositions = [];
        this.peakEquity = 0;
        this.currentEquity = 0;

        this.MAX_DAILY_LOSS_USD = parseFloat(process.env.MAX_DAILY_LOSS_USD) || 1000;
        this.MAX_LEVERAGE = parseFloat(process.env.MAX_LEVERAGE) || 10;
        this.MAX_POSITIONS = parseInt(process.env.MAX_POSITIONS) || 5;
        this.MAX_DRAWDOWN_PERCENT = parseFloat(process.env.MAX_DRAWDOWN_PERCENT) || 0.05;

        console.log('RiskGuard initialized with config:', {
            MAX_DAILY_LOSS_USD: this.MAX_DAILY_LOSS_USD,
            MAX_LEVERAGE: this.MAX_LEVERAGE,
            MAX_POSITIONS: this.MAX_POSITIONS,
            MAX_DRAWDOWN_PERCENT: this.MAX_DRAWDOWN_PERCENT
        });
    }

    resetDailyMetrics() {
        this.dailyLoss = 0;
        console.log('RiskGuard: Daily metrics reset.');
    }

    updateEquity(newEquity) {
        this.currentEquity = newEquity;
        if (newEquity > this.peakEquity) {
            this.peakEquity = newEquity;
        }
        
        if (this.peakEquity > 0) {
            const drawdown = (this.peakEquity - newEquity) / this.peakEquity;
            this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);
        }
    }

    checkTrade(tradeParams) {
        const { symbol, size, leverage } = tradeParams;

        if (this.dailyLoss >= this.MAX_DAILY_LOSS_USD) {
            console.warn(`RiskGuard REJECT: Max daily loss exceeded (${this.dailyLoss} >= ${this.MAX_DAILY_LOSS_USD})`);
            return false;
        }

        if (this.maxDrawdown >= this.MAX_DRAWDOWN_PERCENT) {
            console.warn(`RiskGuard REJECT: Max drawdown limit reached (${(this.maxDrawdown * 100).toFixed(2)}% >= ${(this.MAX_DRAWDOWN_PERCENT * 100).toFixed(2)}%)`);
            return false;
        }

        if (leverage > this.MAX_LEVERAGE) {
            console.warn(`RiskGuard REJECT: Leverage too high (${leverage} > ${this.MAX_LEVERAGE})`);
            return false;
        }

        if (this.openPositions.length >= this.MAX_POSITIONS) {
             console.warn(`RiskGuard REJECT: Max open positions reached (${this.openPositions.length} >= ${this.MAX_POSITIONS})`);
             return false;
        }
        
        const existingPosition = this.openPositions.find(p => p.symbol === symbol);
        if (existingPosition) {
             console.log(`RiskGuard: Adding to existing position for ${symbol}`);
        }

        return true;
    }

    updateMetrics(pnl) {
        if (pnl < 0) {
            this.dailyLoss += Math.abs(pnl);
        } else {
             this.dailyLoss -= pnl;
             if (this.dailyLoss < 0) this.dailyLoss = 0;
        }

        console.log(`RiskGuard: Metrics updated. Daily Loss (Net): ${this.dailyLoss.toFixed(2)}, Max Drawdown: ${(this.maxDrawdown * 100).toFixed(2)}%`);

        if (this.dailyLoss >= this.MAX_DAILY_LOSS_USD) {
            console.error('RiskGuard ALERT: DAILY LOSS LIMIT BREACHED!');
            this.emergencyCloseAll();
        }
    }

    registerTrade(tradeDetails) {
        this.openPositions.push(tradeDetails);
        console.log(`RiskGuard: Position registered. Total open: ${this.openPositions.length}`);
    }

    closePosition(symbol) {
        this.openPositions = this.openPositions.filter(p => p.symbol !== symbol);
        console.log(`RiskGuard: Position closed for ${symbol}. Total open: ${this.openPositions.length}`);
    }

    emergencyCloseAll() {
        console.log("!!! RiskGuard EMERGENCY: CLOSING ALL POSITIONS !!!");
        this.openPositions = [];
        return true;
    }
}

export default RiskGuard;
