/* eslint-disable @typescript-eslint/no-require-imports */

if (__DEV__ && process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true') {
  module.exports = require('./.rnstorybook').default;
} else {
  module.exports = require('expo-router/entry');
}
