/**
 * Feature flag wrapper (issue #213) — WEB module, init() THROWS.
 *
 * Regression for the review finding (Greptile T-Rex repro): with an api key
 * present but posthog-js `init()` throwing, `useAppFeatureFlag`'s effect used
 * to call init() outside any guard and crash the component. The fail-safe
 * contract requires both APIs to settle on the declared default instead.
 * Lives in its own file because the env key and the throwing SDK are baked in
 * at module load (one registry holds one configuration).
 */

import { renderHook } from '@testing-library/react-native';
import { FLAG_KEYS } from '@/services/feature-flags';

const mockInit = jest.fn(() => {
  throw new Error('posthog init exploded');
});
const mockIsFeatureEnabled = jest.fn();
const mockOnFeatureFlags = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    init: mockInit,
    isFeatureEnabled: mockIsFeatureEnabled,
    onFeatureFlags: mockOnFeatureFlags,
  },
}));

process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test_key';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tel = require('@/services/telemetry.web') as typeof import('@/services/telemetry.web');

describe('web feature flags when posthog.init throws', () => {
  it('isFeatureEnabled returns the declared default instead of throwing', () => {
    expect(tel.isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR)).toBe(false);
    expect(mockInit).toHaveBeenCalled();
  });

  it('useAppFeatureFlag renders the declared default instead of crashing', () => {
    const { result, unmount } = renderHook(() =>
      tel.useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR),
    );
    expect(result.current).toBe(false);
    // init threw before subscription — nothing to unsubscribe, nothing leaked.
    expect(mockOnFeatureFlags).not.toHaveBeenCalled();
    unmount();
  });
});
