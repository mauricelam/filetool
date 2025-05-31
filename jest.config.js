module.exports = {
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testEnvironment: 'jsdom', // Changed from 'node' to 'jsdom'
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  roots: ['<rootDir>'],
  transform: {
    // This transform configuration is likely still being ignored by Jest in this environment,
    // as evidenced by the need for command-line --transform.
    // However, keeping it reflects what *should* ideally work.
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '/app/tsconfig.json',
      babelConfig: false,
    }],
    '^.+\\.jsx?$': 'babel-jest',
  },
  // Removed haste configuration block to resolve watchman incompatibility
};
