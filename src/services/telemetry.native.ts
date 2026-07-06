import type { PostHogEventProperties } from '@posthog/core';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useEffect, useState } from 'react';
import { PostHog, type PostHogOptions } from 'posthog-react-native';
import { type FeatureFlagKey, FLAG_DEFAULTS } from '@/services/feature-flags';

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
    // Don't forward console/Logcat output into recordings — log calls can carry
    // tokens, JWTs, or user data we don't want captured in replays (Android-only).
    captureLog: false,
    // iOS-only; captures request metrics (timing, size, status) — not bodies.
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

// ---------------------------------------------------------------------------
// Feature flag API — re-export registry types for callers
// ---------------------------------------------------------------------------
export { FLAG_KEYS, FLAG_DEFAULTS } from '@/services/feature-flags';
export type { FeatureFlagKey } from '@/services/feature-flags';

/**
 * Synchronously checks whether a feature flag is enabled, using PostHog's
 * in-memory / persisted cache.  Safe to call from services and pure
 * functions; makes no network request.
 *
 * Fail-safe: returns the flag's declared default whenever PostHog is not
 * initialised, the device is offline and the flag has not yet been cached,
 * or the SDK throws for any reason.
 *
 * @param key - A known flag key from FLAG_KEYS (typo → compile error).
 * @returns boolean — always, never undefined.
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const defaultValue = FLAG_DEFAULTS[key];
  if (!posthogClient) {
    return defaultValue;
  }
  try {
    const result = posthogClient.isFeatureEnabled(key);
    // SDK returns boolean | undefined; treat undefined as the declared default.
    return result ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * React hook that returns whether a feature flag is enabled and re-renders
 * when PostHog refreshes flags (e.g. after reloadFeatureFlagsAsync()).
 *
 * Fail-safe: same semantics as `isFeatureEnabled` — returns the declared
 * default when PostHog is not available; never throws or returns undefined.
 *
 * @param key - A known flag key from FLAG_KEYS (typo → compile error).
 * @returns boolean — always, never undefined.
 */
export function useAppFeatureFlag(key: FeatureFlagKey): boolean {
  const defaultValue = FLAG_DEFAULTS[key];

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!posthogClient) return defaultValue;
    try {
      return posthogClient.isFeatureEnabled(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (!posthogClient) return;

    // Subscribe to flag refreshes so the component re-renders automatically.
    // The initial value is already read synchronously in the useState initializer;
    // we only need to update when PostHog reloads flags (e.g. after network comes
    // back up or reloadFeatureFlagsAsync() is called).
    const unsubscribe = posthogClient.onFeatureFlags(() => {
      try {
        setEnabled(posthogClient.isFeatureEnabled(key) ?? defaultValue);
      } catch {
        setEnabled(defaultValue);
      }
    });

    return unsubscribe;
  }, [key, defaultValue]);

  return enabled;
}
