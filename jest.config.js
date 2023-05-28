'use strict';

/**
 * @type {import('jest').Config}
 */
module.exports = {
  restoreMocks: true,
  resetMocks: true,
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  // ? 24h if debugging so MMS and other tools don't choke, otherwise 1m
  testTimeout:
    1000 *
    60 *
    (process.env.VSCODE_INSPECTOR_OPTIONS
      ? 60 * 24
      : process.platform == 'win32'
      ? 5
      : 1),
  // ? Minimum of 2 concurrent tests executed at once; maximum of cpu cores - 1
  maxConcurrency: Math.max(require('node:os').cpus().length - 1, 2),
  verbose: false,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // ! If changed, also update these aliases in tsconfig.json,
  // ! babel.config.js, webpack.config.js, next.config.ts, and .eslintrc.js
  moduleNameMapper: {
    '^universe/(.*)$': '<rootDir>/src/$1',
    '^multiverse/(.*)$': '<rootDir>/lib/$1',
    '^testverse/(.*)$': '<rootDir>/test/$1',
    '^externals/(.*)$': '<rootDir>/external-scripts/$1',
    '^types/(.*)$': '<rootDir>/types/$1',
    '^package$': '<rootDir>/package.json',
    // ? These are used at various points (including at compile time by
    // ? Next.js) to get mongo schema configuration and/or test dummy data.
    // ! Must be defined if using @xunnamius/mongo-schema
    '^configverse/get-schema-config$': '<rootDir>/src/backend/db.ts',
    // ! Must be defined if using @xunnamius/mongo-test
    '^configverse/get-dummy-data$': '<rootDir>/test/db.ts'
  },
  setupFilesAfterEnv: ['./test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts*',
    'lib/**/*.ts*',
    'external-scripts/**/*.ts*',
    '!**/*.test.*'
  ],
  // ? Make sure jest-haste-map doesn't try to parse and cache fixtures
  modulePathIgnorePatterns: ['<rootDir>/test/fixtures'],
  // ? Transform specific third-party ESM packages into CJS using babel
  transformIgnorePatterns: ['node_modules/(?!(dot-prop|unfetch)/)']
};
