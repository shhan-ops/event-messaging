/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@shhan-ops/event-messaging$': '<rootDir>/core/index.ts',
    '^@shhan-ops/event-messaging/adapters/redis$': '<rootDir>/adapters/redis/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
