const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

const config = getSentryExpoConfig(__dirname);

module.exports =
  process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true' ? withStorybook(config) : config;
