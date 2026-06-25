/* eslint-disable @typescript-eslint/no-require-imports -- Jest setup file: requires the worklets mock module at runtime. */
/* global jest */

// react-native-worklets 0.8+ (a dependency of react-native-reanimated 4.x) throws
// "Native part of Worklets doesn't seem to be initialized" under Jest because its
// native module is unavailable in the test environment. Reanimated's own mock
// (`react-native-reanimated/mock`) transitively requires the real worklets module,
// so we mock worklets globally with the mock API it ships. This must run before any
// reanimated import, hence it lives in `setupFiles` (ahead of the test bodies).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
