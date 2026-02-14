module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@widgets/(.*)$': '<rootDir>/components/widgets/$1',
    '^@widgets/shared$': '<rootDir>/components/widgets/shared',
  },
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  collectCoverageFrom: [
    'components/widgets/**/*.{ts,tsx}',
    '!components/widgets/**/*.stories.tsx',
    '!components/widgets/**/index.ts',
  ],
};
