/* global jest */
const sentryScope = {
  setContext: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  setLevel: jest.fn(),
  setUser: jest.fn(),
};

const Sentry = {
  init: jest.fn(),
  wrap: (Component) => Component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  reactNativeTracingIntegration: jest.fn(() => ({})),
  withScope: (callback) => {
    if (typeof callback === 'function') callback(sentryScope);
  },
};

module.exports = Sentry;
