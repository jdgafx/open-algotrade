import RiskGuard from '../risk-guard.js';

class HyperliquidDynamicLeverage {
    constructor(config = {}) {
        this.symbol = config.symbol || 'BTC-USD';
        this.emaPeriod = config.emaPeriod || 20;
        this.adxPeriod = config.adxPeriod || 14;
        this.size = config.size || 100;
        this.maxLeverage = config.maxLeverage || 40;

        this.riskGuard = new RiskGuard();

        this.priceHistory = []; 
        this.currentPosition = null;
        this.lastAdx = 0;
        this.lastEma = 0;
    }

    async processPriceData(candle) {
        if (!candle || typeof candle.close !== 'number') {
            console.warn('Invalid candle data received');
            return null;
        }

        this.priceHistory.push(candle);
        
        const minHistory = Math.max(this.emaPeriod, this.adxPeriod * 2 + 10);
        if (this.priceHistory.length > minHistory + 100) {
            this.priceHistory.shift();
        }

        if (this.priceHistory.length < minHistory) {
            return { action: 'hold', reason: 'Not enough data' };
        }

        const closes = this.priceHistory.map(c => c.close);
        const ema = this.calculateEMA(closes, this.emaPeriod);
        const adx = this.calculateADX(this.priceHistory, this.adxPeriod);

        this.lastEma = ema;
        this.lastAdx = adx;

        const currentPrice = candle.close;
        const trendStrength = adx;

        console.log(`[${this.symbol}] Price: ${currentPrice}, EMA: ${ema.toFixed(2)}, ADX: ${adx.toFixed(2)}`);

        let signal = null;
        let leverage = 1;

        if (trendStrength > 25) {
            if (currentPrice > ema) {
                signal = 'buy';
            } else if (currentPrice < ema) {
                signal = 'sell';
            }

            if (trendStrength < 30) {
                leverage = 5;
            } else if (trendStrength < 50) {
                leverage = 10;
            } else {
                leverage = Math.min(this.maxLeverage, 20); 
            }
        }

        if (signal) {
            if (this.currentPosition && this.currentPosition.side !== signal) {
                await this.closePosition();
            }

            if (!this.currentPosition) {
                const result = await this.openPosition(signal, leverage, currentPrice);
                return { ...result, adx, ema };
            }
        }

        return { action: 'hold', adx, ema, leverage };
    }

    async openPosition(side, leverage, price) {
        const tradeParams = {
            symbol: this.symbol,
            size: this.size,
            leverage: leverage,
            side: side,
            price: price
        };

        if (!this.riskGuard.checkTrade(tradeParams)) {
            console.warn(`[RiskGuard] Blocked ${side} trade for ${this.symbol} at ${leverage}x`);
            return { action: 'blocked', reason: 'RiskGuard' };
        }

        console.log(`OPENING ${side.toUpperCase()} POSITION: ${leverage}x leverage @ ${price}`);
        
        this.currentPosition = {
            side,
            entryPrice: price,
            leverage,
            size: this.size,
            openTime: Date.now()
        };

        this.riskGuard.registerTrade(this.currentPosition);

        return { 
            action: 'open', 
            side, 
            leverage, 
            price 
        };
    }

    async closePosition() {
        if (!this.currentPosition) return;

        console.log(`CLOSING ${this.currentPosition.side.toUpperCase()} POSITION`);
        
        const lastPrice = this.priceHistory[this.priceHistory.length - 1].close;
        const entryPrice = this.currentPosition.entryPrice;
        let pnl = 0;
        
        if (this.currentPosition.side === 'buy') {
            pnl = (lastPrice - entryPrice) * this.currentPosition.size;
        } else {
            pnl = (entryPrice - lastPrice) * this.currentPosition.size;
        }

        this.riskGuard.updateMetrics(pnl); 
        this.riskGuard.closePosition(this.symbol);
        
        this.currentPosition = null;
    }

    calculateEMA(data, period) {
        if (data.length < period) return data[data.length - 1]; 
        
        const k = 2 / (period + 1);
        let sum = 0;
        for(let i=0; i<period; i++) sum += data[i];
        let ema = sum / period;

        for (let i = period; i < data.length; i++) {
            ema = (data[i] * k) + (ema * (1 - k));
        }
        return ema;
    }

    calculateADX(candles, period) {
        if (candles.length < period * 2) return 0;

        let tr = [];
        let plusDm = [];
        let minusDm = [];

        for (let i = 1; i < candles.length; i++) {
            const curr = candles[i];
            const prev = candles[i - 1];

            const highDiff = curr.high - prev.high;
            const lowDiff = prev.low - curr.low;

            const trVal = Math.max(
                curr.high - curr.low,
                Math.abs(curr.high - prev.close),
                Math.abs(curr.low - prev.close)
            );
            tr.push(trVal);

            if (highDiff > lowDiff && highDiff > 0) {
                plusDm.push(highDiff);
            } else {
                plusDm.push(0);
            }

            if (lowDiff > highDiff && lowDiff > 0) {
                minusDm.push(lowDiff);
            } else {
                minusDm.push(0);
            }
        }

        let smoothTr = 0;
        let smoothPlusDm = 0;
        let smoothMinusDm = 0;

        for (let i = 0; i < period; i++) {
            smoothTr += tr[i];
            smoothPlusDm += plusDm[i];
            smoothMinusDm += minusDm[i];
        }

        let dxValues = [];

        for (let i = period; i < tr.length; i++) {
            const currentTr = tr[i];
            const currentPlusDm = plusDm[i];
            const currentMinusDm = minusDm[i];

            smoothTr = smoothTr - (smoothTr / period) + currentTr;
            smoothPlusDm = smoothPlusDm - (smoothPlusDm / period) + currentPlusDm;
            smoothMinusDm = smoothMinusDm - (smoothMinusDm / period) + currentMinusDm;

            const plusDi = (smoothPlusDm / smoothTr) * 100;
            const minusDi = (smoothMinusDm / smoothTr) * 100;

            let dx = 0;
            if (plusDi + minusDi !== 0) {
                dx = (Math.abs(plusDi - minusDi) / (plusDi + minusDi)) * 100;
            }
            dxValues.push(dx);
        }

        if (dxValues.length < period) return dxValues[dxValues.length - 1] || 0;

        const lastPeriodDx = dxValues.slice(-period);
        const sumDx = lastPeriodDx.reduce((a, b) => a + b, 0);
        return sumDx / period;
    }
}

export default HyperliquidDynamicLeverage;
