import posthog from 'posthog-js';
import { useEffect, useState } from 'react';

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
  const defaultValue = FLAG_DEFAULTS[key];

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!apiKey) return defaultValue;
    try {
      init();
      return posthog.isFeatureEnabled(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (!apiKey) return;

    // Subscribe to flag refreshes so the component re-renders automatically.
    // The initial value is already read synchronously in the useState initializer;
    // we only need to update when PostHog reloads flags (e.g. after network comes
    // back up or reloadFeatureFlags() is called).
    init();
    const unsubscribe = posthog.onFeatureFlags(() => {
      try {
        setEnabled(posthog.isFeatureEnabled(key) ?? defaultValue);
      } catch {
        setEnabled(defaultValue);
      }
    });

    return unsubscribe;
  }, [key, defaultValue]);

  return enabled;
}
