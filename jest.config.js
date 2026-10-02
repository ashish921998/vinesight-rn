module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    '<rootDir>/jest-setup/worklets-mock.js',
    '<rootDir>/jest-setup/deno-mock.js',
    'react-native-gesture-handler/jestSetup.js',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.worktrees/'],
  // Sentry 8 publishes its shared packages as ESM. The jest-expo preset only
  // transforms @sentry/react-native, leaving @sentry/core untranspiled.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry|native-base|standard-navigation))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@widgets/shared$': '<rootDir>/components/widgets/shared',
    '^@widgets/(.*)$': '<rootDir>/components/widgets/$1',
    '^expo-file-system/legacy$': 'expo-file-system',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^react-native-mmkv$': '<rootDir>/jest-setup/mmkv-mock.js',
  },
  collectCoverageFrom: ['components/widgets/**/*.{ts,tsx}', '!components/widgets/**/index.ts'],
};
