const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

const config = getSentryExpoConfig(__dirname);

// @expo/ui's Compose <Icon> loads Android XML vector drawables via require(), so
// Metro must treat .xml as an asset rather than source.
config.resolver.assetExts.push('xml');

module.exports =
  process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true' ? withStorybook(config) : config;
