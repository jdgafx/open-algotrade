import { TurtleTradingStrategy } from '../services/moondev-algorithms.js';

describe('Debug Info', () => {
    test('Algorithms should be loaded', () => {
        expect(TurtleTradingStrategy).toBeDefined();
    });

    test('Environment should be correct', () => {
        expect(process.env.NODE_OPTIONS).toContain('--experimental-vm-modules');
    });
});
