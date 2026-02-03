import type { PostHogEventProperties } from '@posthog/core';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { PostHog, type PostHogOptions } from 'posthog-react-native';

export type TelemetryProperties = PostHogEventProperties;

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null;
const hostRaw = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const host = hostRaw.replace(/\/+$/, '');

const options: PostHogOptions = {
  host,
  captureAppLifecycleEvents: true,
};

const isPhysicalDevice = Device.isDevice ?? false;
const appOwnership = Constants.appOwnership;
const isStandalone = appOwnership === 'standalone';
const runtimeDisabled = !isPhysicalDevice || !isStandalone;

export const telemetryEnabled = Boolean(apiKey) && !runtimeDisabled;

export const posthogClient = telemetryEnabled ? new PostHog(apiKey, options) : null;

export const telemetry = {
  capture: (event: string, properties?: TelemetryProperties) => {
    if (!posthogClient) return;
    posthogClient.capture(event, properties);
  },
  screen: (name: string, properties?: TelemetryProperties) => {
    if (!posthogClient) return;
    void posthogClient.screen(name, properties);
  },
  identify: (distinctId: string, properties?: TelemetryProperties) => {
    if (!posthogClient) return;
    void posthogClient.identify(distinctId, properties);
  },
  reset: () => {
    posthogClient?.reset();
  },
  flush: async () => {
    if (!posthogClient) return;
    try {
      await posthogClient.flush();
    } catch (_error) {
      // ignore
    }
  },
};

export const telemetryConfig = {
  apiKey,
  host,
  options,
  isPhysicalDevice,
  appOwnership,
  runtimeDisabled,
};
