import type { PostHogEventProperties } from '@posthog/core';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { PostHog, type PostHogOptions } from 'posthog-react-native';

export type TelemetryProperties = PostHogEventProperties;

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null;
const hostRaw = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const host = hostRaw.replace(/\/+$/, '');

const allowSimulator =
  (process.env.EXPO_PUBLIC_POSTHOG_ALLOW_SIMULATOR?.trim().toLowerCase() ?? '') === 'true';

// WARNING: EXPO_PUBLIC_POSTHOG_ALLOW_SIMULATOR should only be set in non-production PostHog projects.
// Setting this in production will emit real events from simulators/CI, polluting production data.

const options: PostHogOptions = {
  host,
  captureAppLifecycleEvents: true,
  // Mobile session replay. Lets us watch how users move through onboarding and
  // where they drop off. Privacy-conscious defaults: text inputs are masked so
  // we never record what people type, while images stay visible so replays are
  // actually useful for understanding the flow.
  enableSessionReplay: true,
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: false,
    captureLog: true,
    captureNetworkTelemetry: true,
  },
};

const isPhysicalDevice = Device.isDevice ?? false;
const executionEnvironment = Constants.executionEnvironment;
const isStandaloneOrBare = executionEnvironment === 'standalone' || executionEnvironment === 'bare';
const runtimeDisabled = (!isPhysicalDevice && !allowSimulator) || !isStandaloneOrBare;

export const telemetryEnabled = Boolean(apiKey) && !runtimeDisabled;

export const posthogClient = telemetryEnabled ? new PostHog(apiKey as string, options) : null;

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
  allowSimulator,
  isPhysicalDevice,
  executionEnvironment,
  isStandaloneOrBare,
  runtimeDisabled,
};
