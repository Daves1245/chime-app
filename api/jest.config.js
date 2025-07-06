/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/src/tests/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/jest-setup.ts'],
  
  // More verbose output
  verbose: true,
  
  // Show individual test results
  reporters: [
    'default'
  ],
  
  // Better error messages
  errorOnDeprecated: true,
  
  // Coverage settings for better visibility
  collectCoverage: false, // Set to true if you want coverage reports
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Timeout for async tests
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Better stack traces
  maxWorkers: 1, // Run tests serially for clearer output
  
  // Better diff output
  expand: true,
};