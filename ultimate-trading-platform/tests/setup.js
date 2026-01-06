import { jest } from '@jest/globals';

// Mock Window/DOM globals
global.window = global;
global.showLoading = jest.fn();
global.hideLoading = jest.fn();
global.updateUI = jest.fn();
global.showNotification = jest.fn();
global.updateUserDisplay = jest.fn();
global.updateActiveStrategiesDisplay = Object.assign(
  jest.fn(),
  { getActiveStrategies: jest.fn(() => []) }
);

global.WebSocket = class {
  constructor(url) { this.url = url; }
  onopen() { }
  onerror() { }
  onclose() { }
  onmessage() { }
  send() { }
  close() { }
};

// Mock Puter.js
const mockKV = new Map();
global.puter = {
  kv: {
    get: jest.fn((key) => Promise.resolve(mockKV.get(key) || null)),
    set: jest.fn((key, value) => {
      mockKV.set(key, value);
      return Promise.resolve(true);
    }),
    delete: jest.fn((key) => {
      mockKV.delete(key);
      return Promise.resolve(true);
    }),
    incr: jest.fn((key) => {
      const val = (mockKV.get(key) || 0) + 1;
      mockKV.set(key, val);
      return Promise.resolve(val);
    }),
    list: jest.fn(() => Promise.resolve(Array.from(mockKV.keys()))),
  },
  ai: {
    chat: jest.fn(() => Promise.resolve(JSON.stringify({
      ranked_strategies: [{ name: "turtle-trading", score: 0.9, allocation: 0.3 }],
      sentiment: "bullish",
      signal: "buy",
      action: "buy",
      confidence: 0.85,
      risk: "medium",
      position_size: 100
    }))),
  },
  auth: {
    getUser: jest.fn(() => Promise.resolve({ id: 'test-user', username: 'tester' })),
    isSignedIn: jest.fn(() => Promise.resolve(true)),
  },
  print: jest.fn(() => Promise.resolve()),
  ui: {
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
  }
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);
