/**
 * Tests for the PostHog feature flag wrapper (issue #213) — client PRESENT.
 *
 * Covers the ACs:
 *   (a) flag on  → true
 *   (b) flag off → false
 *   (c) SDK undefined / SDK throws → declared default
 *   (d) unknown flag key → type-constrained at compile time (registry enforces it)
 *
 * These tests exercise the REAL telemetry module — its dependencies
 * (posthog-react-native, expo-constants, expo-device) are mocked, never the
 * module under test. Mocking `@/services/telemetry` itself would reimplement
 * the wrapper inside the mock and prove nothing about the shipped code.
 *
 * `posthogClient` is constructed at module load from env + device state, so
 * the env is arranged top-level and the module require()d after it (imports
 * hoist above assignments, so a static import would read the env too early).
 * The client-ABSENT paths live in feature-flags-disabled.test.ts — a separate
 * file, because one module registry can only hold one configuration and
 * jest.isolateModules would fork React away from the test renderer's copy.
 */

import { act, renderHook } from '@testing-library/react-native';
import { FLAG_KEYS, FLAG_DEFAULTS, type FeatureFlagKey } from '@/services/feature-flags';

// ---------------------------------------------------------------------------
// Dependency mocks — the PostHog client the real module will construct.
// ---------------------------------------------------------------------------

const mockIsFeatureEnabled = jest.fn<boolean | undefined, [string]>();
const mockUnsubscribe = jest.fn();
let flagsCallback: (() => void) | null = null;
const mockOnFeatureFlags = jest.fn((cb: () => void) => {
  flagsCallback = cb;
  return mockUnsubscribe;
});

jest.mock('posthog-react-native', () => ({
  PostHog: jest.fn(() => ({
    isFeatureEnabled: mockIsFeatureEnabled,
    onFeatureFlags: mockOnFeatureFlags,
  })),
}));

// telemetryEnabled requires a physical device + standalone/bare execution.
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test_key';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tel = require('@/services/telemetry.native') as typeof import('@/services/telemetry.native');

beforeEach(() => {
  mockIsFeatureEnabled.mockReset();
  mockOnFeatureFlags.mockClear();
  mockUnsubscribe.mockClear();
  flagsCallback = null;
});

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

describe('FLAG_KEYS registry', () => {
  it('exports the compliance-evaluator key', () => {
    expect(FLAG_KEYS.COMPLIANCE_EVALUATOR).toBe('compliance-evaluator');
  });

  it('compliance-evaluator default is false (kill-switch semantics)', () => {
    expect(FLAG_DEFAULTS[FLAG_KEYS.COMPLIANCE_EVALUATOR]).toBe(false);
  });

  it('every registered key has a declared boolean default', () => {
    for (const key of Object.values(FLAG_KEYS)) {
      expect(typeof FLAG_DEFAULTS[key]).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// isFeatureEnabled — the real wrapper, real client wiring
// ---------------------------------------------------------------------------

describe('isFeatureEnabled (real module, mocked SDK)', () => {
  it('constructed a client (sanity: env + device mocks took effect)', () => {
    expect(tel.posthogClient).not.toBeNull();
  });

  it('returns true when PostHog reports the flag enabled', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(true);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('compliance-evaluator');
  });

  it('returns false when PostHog reports the flag disabled', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(false);
  });

  it('returns the declared default when the SDK returns undefined (flags not yet cached)', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined);
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(false);
  });

  it('returns the declared default when the SDK throws (e.g. network/storage error)', () => {
    mockIsFeatureEnabled.mockImplementation(() => {
      throw new Error('posthog exploded');
    });
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(false);
  });

  it('never returns undefined regardless of SDK state', () => {
    for (const sdkValue of [true, false, undefined]) {
      mockIsFeatureEnabled.mockReturnValue(sdkValue);
      expect(typeof tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// useAppFeatureFlag — hook semantics against the real module
// ---------------------------------------------------------------------------

describe('useAppFeatureFlag (real module, mocked SDK)', () => {
  it('returns the cached value on first render', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR));
    expect(result.current).toBe(true);
  });

  it('re-renders with the new value when PostHog refreshes flags', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR));
    expect(result.current).toBe(false);

    mockIsFeatureEnabled.mockReturnValue(true);
    act(() => flagsCallback?.());
    expect(result.current).toBe(true);
  });

  it('falls back to the declared default when a refresh read throws', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR));
    expect(result.current).toBe(true);

    mockIsFeatureEnabled.mockImplementation(() => {
      throw new Error('posthog exploded');
    });
    act(() => flagsCallback?.());
    expect(result.current).toBe(false); // declared default, not a crash
  });

  it('unsubscribes from flag refreshes on unmount', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    const { unmount } = renderHook(() => tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR));
    expect(mockOnFeatureFlags).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Compile-time key constraint (documented; enforced by tsc, not jest)
// ---------------------------------------------------------------------------

describe('FeatureFlagKey type constraint', () => {
  it('accepts a valid FLAG_KEYS value', () => {
    const key: FeatureFlagKey = FLAG_KEYS.COMPLIANCE_EVALUATOR;
    expect(key).toBe('compliance-evaluator');
  });

  it('the union only permits known keys (typo would be a tsc error)', () => {
    // @ts-expect-error — unknown flag keys must not typecheck
    const bad: FeatureFlagKey = 'not-a-real-flag';
    expect(bad).toBe('not-a-real-flag');
  });
});
