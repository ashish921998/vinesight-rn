const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname, {
  // These are web-only packages (DOM session replay + feedback widget) re-exported
  // by @sentry/browser, which @sentry/react-native depends on. Metro can't tree-shake
  // the re-exports, so they'd otherwise ship ~400 KB of dead code in the native bundle.
  // The native options stub the packages AND their @sentry/browser wrappers correctly
  // (the wrappers call buildFeedbackIntegration() at eval time, so a naive stub crashes).
  includeWebReplay: false,
  includeWebFeedback: false,
});

// @expo/ui's Compose <Icon> loads Android XML vector drawables via require(), so
// Metro must treat .xml as an asset rather than source.
config.resolver.assetExts.push('xml');

module.exports = config;
