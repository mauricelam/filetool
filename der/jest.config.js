module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest', // Assuming ts-jest will be installed or is available
  },
  moduleNameMapper: {
    // If you have module aliases in tsconfig.json, you might need to map them here
    // For example: '^@components/(.*)$': '<rootDir>/src/components/$1'
  },
  setupFilesAfterEnv: ['@testing-library/jest-dom'], // For additional matchers
};
