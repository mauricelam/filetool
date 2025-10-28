module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./setupTests.ts'],
  roots: ['<rootDir>/../components'],
  moduleNameMapper: {
    '\\.(css|less)$': 'identity-obj-proxy',
    '^../../file-type-detector$': '<rootDir>/../file-type-detector/index.ts',
    '^../PreviewComponent$': '<rootDir>/../components/PreviewComponent.tsx',
  },
};
