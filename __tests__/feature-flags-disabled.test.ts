/**
 * Feature flag wrapper (issue #213) — client ABSENT.
 *
 * The offline/uninitialised half of the AC: with no PostHog api key the
 * module never constructs a client, and both the sync check and the hook
 * must resolve to each flag's declared default — never throw, never block,
 * never subscribe. Lives in its own file because `posthogClient` is baked in
 * at module load: one registry holds one configuration, and
 * jest.isolateModules would fork React away from the test renderer's copy.
 */

import { renderHook } from '@testing-library/react-native';
import { FLAG_KEYS } from '@/services/feature-flags';

const mockIsFeatureEnabled = jest.fn();
const mockOnFeatureFlags = jest.fn();

jest.mock('posthog-react-native', () => ({
  PostHog: jest.fn(() => ({
    isFeatureEnabled: mockIsFeatureEnabled,
    onFeatureFlags: mockOnFeatureFlags,
  })),
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

// No key → telemetryEnabled false → posthogClient null. Deleted explicitly:
// another test file in the same worker may have set it.
delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tel = require('@/services/telemetry.native') as typeof import('@/services/telemetry.native');

describe('feature flags without an initialised PostHog client', () => {
  it('never constructed a client (sanity)', () => {
    expect(tel.posthogClient).toBeNull();
    expect(tel.telemetryEnabled).toBe(false);
  });

  it('isFeatureEnabled returns the declared default and never touches the SDK', () => {
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(false);
    expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it('useAppFeatureFlag returns the declared default and subscribes to nothing', () => {
    const { result } = renderHook(() => tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR));
    expect(result.current).toBe(false);
    expect(mockOnFeatureFlags).not.toHaveBeenCalled();
  });
});
