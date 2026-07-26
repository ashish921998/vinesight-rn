/**
 * Feature flag registry.
 *
 * All flag keys are defined here as a const object so callers get a
 * compile-error on a typo (FeatureFlagKey is a union of the keys, not
 * a plain string).  The registry also documents each flag's:
 *   - default value  (what is returned when PostHog is unreachable / not yet
 *                     initialised / offline / throws)
 *   - rollout plan
 *
 * Fail-safe contract
 * ------------------
 * `isFeatureEnabled` (exported from `@/services/telemetry`) NEVER throws,
 * NEVER returns undefined to callers.  When the underlying PostHog check
 * cannot be performed it returns the declared default for that flag.
 *
 * Usage from services (synchronous, reads PostHog's in-memory cache):
 *   import { isFeatureEnabled, FLAG_KEYS } from '@/services/telemetry';
 *   const enabled = isFeatureEnabled(FLAG_KEYS.COMPLIANCE_EVALUATOR);
 *
 * Usage from components (re-renders when PostHog refreshes flags):
 *   import { useAppFeatureFlag, FLAG_KEYS } from '@/services/telemetry';
 *   const enabled = useAppFeatureFlag(FLAG_KEYS.COMPLIANCE_EVALUATOR);
 */

// ---------------------------------------------------------------------------
// Registry — add every flag here; never declare defaults at call sites.
// ---------------------------------------------------------------------------

export const FLAG_KEYS = {
  /**
   * compliance-evaluator
   *
   * Kill switch + canary rollout gate for the shared grape spray compliance
   * evaluator (Unit 3, plan T2/OV-1).
   *
   * Default: FALSE — evaluator is OFF unless PostHog explicitly enables it.
   * This is a rollout flag, not a ramp-down flag; the safe fallback is the
   * legacy unverified / PHI-only behavior that shipped before this feature.
   *
   * Rollout plan:
   *   1. OFF (default) — all users see legacy behavior; kill switch active.
   *   2. Canary cohort (~5% of pilot farms, identified by person property
   *      `pilot_cohort: true`) — evaluator live for canary; monitor for
   *      unverified-flip complaints and false negatives.
   *   3. Org-wide rollout (100% of active users) — once canary is stable
   *      for ≥2 harvest cycles with no regressions.
   *   4. Default ON — flag removed from code once rollout is complete and
   *      the kill-switch is no longer needed.
   */
  COMPLIANCE_EVALUATOR: 'compliance-evaluator',

  /**
   * force-simple-mode
   *
   * Ramp-down switch for the Simplified/Detailed app-mode toggle. When enabled,
   * any user still in Detailed mode is pulled back to Simplified without a
   * release (see `enforceSimpleMode` in `src/stores/app-mode-store.ts`).
   *
   * Default: FALSE — the user's own choice wins. Turning this on overrides a
   * deliberate opt-in, so scope it to a cohort before going 100%.
   *
   * Note: enforcement is sticky. It writes `detailedMode: false` through to
   * AsyncStorage, so turning the flag back off does NOT restore Detailed mode —
   * affected users must re-enable it in Settings.
   */
  FORCE_SIMPLE_MODE: 'force-simple-mode',
} as const;

/** Union type of all known flag keys — a typo is a compile error. */
export type FeatureFlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

/** Per-flag default values returned when PostHog is unavailable. */
export const FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  'compliance-evaluator': false,
  'force-simple-mode': false,
};
