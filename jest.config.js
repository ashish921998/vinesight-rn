module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest-setup/deno-mock.js', 'react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@widgets/shared$': '<rootDir>/components/widgets/shared',
    '^@widgets/(.*)$': '<rootDir>/components/widgets/$1',
    '^expo-file-system/legacy$': 'expo-file-system',
    '^@sentry/react-native$': '<rootDir>/jest-setup/sentry-mock.js',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  collectCoverageFrom: [
    'components/widgets/**/*.{ts,tsx}',
    '!components/widgets/**/*.stories.tsx',
    '!components/widgets/**/index.ts',
  ],
};
