import posthog from 'posthog-js';

import type { PostHogEventProperties } from '@posthog/core';

export type TelemetryProperties = PostHogEventProperties;

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null;
const hostRaw = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const host = hostRaw.replace(/\/+$/, '');

let initialized = false;

const init = () => {
  if (initialized) return;
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host: host,
    capture_pageview: false,
  });

  initialized = true;
};

export const telemetryEnabled = Boolean(apiKey);

export const posthogClient = null;

export const telemetry = {
  capture: (event: string, properties?: TelemetryProperties) => {
    if (!apiKey) return;
    init();
    posthog.capture(event, properties);
  },
  screen: (name: string, properties?: TelemetryProperties) => {
    if (!apiKey) return;
    init();
    posthog.capture('screen', { screen: name, ...properties });
  },
  identify: (distinctId: string, properties?: TelemetryProperties) => {
    if (!apiKey) return;
    init();
    posthog.identify(distinctId, properties);
  },
  reset: () => {
    if (!apiKey) return;
    init();
    posthog.reset();
  },
  flush: async () => {
    // posthog-js flush is implicit; keep API parity
  },
};

export const telemetryConfig = { apiKey, host, options: { host } };
