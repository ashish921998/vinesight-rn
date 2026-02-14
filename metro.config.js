const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

const config = getSentryExpoConfig(__dirname);

module.exports = withStorybook(config);
