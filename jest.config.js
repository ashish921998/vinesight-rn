module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@widgets/shared$': '<rootDir>/components/widgets/shared',
    '^@widgets/(.*)$': '<rootDir>/components/widgets/$1',
  },
  collectCoverageFrom: [
    'components/widgets/**/*.{ts,tsx}',
    '!components/widgets/**/*.stories.tsx',
    '!components/widgets/**/index.ts',
  ],
};
