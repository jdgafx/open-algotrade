import { jest } from '@jest/globals';
import HyperliquidDynamicLeverage from '../../services/strategies/HyperliquidDynamicLeverage.js';

describe('HyperliquidDynamicLeverage Strategy', () => {
    let strategy;

    beforeEach(() => {
        strategy = new HyperliquidDynamicLeverage({
            emaPeriod: 10,
            adxPeriod: 10
        });
    });

    function generateCandles(count, startPrice, trend) {
        let candles = [];
        let price = startPrice;
        for (let i = 0; i < count; i++) {
            let high, low, close;
            if (trend === 'up') {
                price += 10;
                high = price + 5;
                low = price - 2;
                close = price;
            } else if (trend === 'down') {
                price -= 10;
                high = price + 2;
                low = price - 5;
                close = price;
            } else {
                price += (Math.random() - 0.5) * 1;
                high = price + 2;
                low = price - 2;
                close = price;
            }
            candles.push({ high, low, close });
        }
        return candles;
    }

    test('should initialize correctly', () => {
        expect(strategy.symbol).toBe('BTC-USD');
        expect(strategy.priceHistory).toEqual([]);
    });

    test('should hold when insufficient data', async () => {
        const candle = { high: 100, low: 90, close: 95 };
        const result = await strategy.processPriceData(candle);
        expect(result.action).toBe('hold');
        expect(result.reason).toBe('Not enough data');
    });

    test('should calculate indicators and hold when ADX is low', async () => {
        const candles = generateCandles(50, 50000, 'flat');
        
        for (let i = 0; i < candles.length - 1; i++) {
            await strategy.processPriceData(candles[i]);
        }
        
        const result = await strategy.processPriceData(candles[candles.length - 1]);
        
        expect(result.action).toBe('hold');
        expect(result.adx).toBeDefined();
        expect(result.ema).toBeDefined();
        expect(result.adx).toBeLessThan(25);
    });

    test('should signal LONG when ADX > 25 and Price > EMA', async () => {
        const initialCandles = generateCandles(50, 50000, 'flat');
        for (const candle of initialCandles) await strategy.processPriceData(candle);

        const uptrendCandles = generateCandles(30, 50000, 'up');
        let lastResult;
        
        for (const candle of uptrendCandles) {
            lastResult = await strategy.processPriceData(candle);
            if (lastResult.action === 'open' && lastResult.side === 'buy') {
                break;
            }
        }

        expect(lastResult.action).toBe('open');
        expect(lastResult.side).toBe('buy');
        expect(lastResult.adx).toBeGreaterThan(25);
    });

    test('should signal SHORT when ADX > 25 and Price < EMA', async () => {
        const initialCandles = generateCandles(50, 50000, 'flat');
        for (const candle of initialCandles) await strategy.processPriceData(candle);

        const downtrendCandles = generateCandles(30, 50000, 'down');
        let lastResult;
        
        for (const candle of downtrendCandles) {
            lastResult = await strategy.processPriceData(candle);
            if (lastResult.action === 'open' && lastResult.side === 'sell') {
                break;
            }
        }

        expect(lastResult.action).toBe('open');
        expect(lastResult.side).toBe('sell');
        expect(lastResult.adx).toBeGreaterThan(25);
    });
});
