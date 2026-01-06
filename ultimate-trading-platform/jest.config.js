export default {
  testEnvironment: 'jsdom',
  transform: {},
  setupFilesAfterEnv: ['./tests/setup.js'],
  moduleNameMapper: {
    '^services/(.*)$': '<rootDir>/services/$1',
  },
};
