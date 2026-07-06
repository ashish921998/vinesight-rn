import posthog from 'posthog-js';
import { useCallback, useSyncExternalStore } from 'react';

import type { PostHogEventProperties } from '@posthog/core';
import { type FeatureFlagKey, FLAG_DEFAULTS } from '@/services/feature-flags';

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
    posthog.capture('$screen', { ...properties, $screen_name: name });
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

// ---------------------------------------------------------------------------
// Feature flag API — re-export registry types for callers
// ---------------------------------------------------------------------------
export { FLAG_KEYS, FLAG_DEFAULTS } from '@/services/feature-flags';
export type { FeatureFlagKey } from '@/services/feature-flags';

/**
 * Synchronously checks whether a feature flag is enabled, using posthog-js's
 * in-memory cache.  Safe to call from services and pure functions; makes no
 * network request.
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
  if (!apiKey) {
    return defaultValue;
  }
  try {
    init();
    const result = posthog.isFeatureEnabled(key);
    // SDK returns boolean | undefined; treat undefined as the declared default.
    return result ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * React hook that returns whether a feature flag is enabled and re-renders
 * when posthog-js refreshes flags.
 *
 * Fail-safe: same semantics as `isFeatureEnabled` — returns the declared
 * default when PostHog is not available; never throws or returns undefined.
 *
 * @param key - A known flag key from FLAG_KEYS (typo → compile error).
 * @returns boolean — always, never undefined.
 */
export function useAppFeatureFlag(key: FeatureFlagKey): boolean {
  // The hook is exactly the external-store shape: subscribe to flag refreshes,
  // read a boolean snapshot. useSyncExternalStore re-reads the snapshot on
  // every render, so a `key` change picks up the new flag immediately (a
  // useState-initializer version showed the old key's value until the next
  // refresh event). All SDK touchpoints are guarded — if init() or the
  // subscription throws, the hook settles on the declared default and simply
  // stops receiving refreshes, never crashes the component.
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!apiKey) return () => {};
    try {
      init();
      return posthog.onFeatureFlags(onStoreChange);
    } catch {
      return () => {};
    }
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => isFeatureEnabled(key),
    () => FLAG_DEFAULTS[key],
  );
}
