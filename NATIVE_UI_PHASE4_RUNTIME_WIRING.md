# Native UI Phase 4 Runtime Wiring

This lane wires native-shell routing decisions into runtime startup flow behind feature flags.

## Added runtime controls
- `EXPO_PUBLIC_NATIVE_UI_ENABLED` (default: `false`)
- `EXPO_PUBLIC_NATIVE_UI_ONBOARDING_ENABLED` (default: `false`)

## Behavior
- Startup still resolves auth/profile bootstrap via shared contract adapter.
- When native UI rollout is disabled, app behavior is unchanged (uses bootstrap Expo path).
- When native UI + onboarding rollout are enabled and auth is complete:
  - app waits for onboarding hydration
  - routes incomplete onboarding users to `/onboarding`
  - routes completed onboarding users to tabs bootstrap path

## Files
- `src/constants/native-ui-flags.ts`
- `src/native/contracts/runtime.ts`
- `src/native/contracts/runtime-hook.ts`
- `src/native/contracts/index.ts`
- `app/index.tsx`
- `__tests__/native-runtime-routing.test.ts`
