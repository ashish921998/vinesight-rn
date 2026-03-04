# Native UI Phase 0 Shell Scaffold

This scaffold provides starter native route registries and bootstrap router logic
that mirror the contract in `src/native/contracts`.

## Directories
- `ios-native-shell-scaffold/VineSightShell/*`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/*`

## Included artifacts
- route/tab enums for each platform shell
- bootstrap routing resolver based on auth/profile snapshot
- auth flow coordinators aligned to the shared JS auth-flow contract

## Contract sync rule
When `src/native/contracts/manifest.ts` changes:
1. Update `src/native/shell/route-registry.ts`
2. Update iOS + Android scaffold registries
3. Run tests:
   - `npm test -- --runInBand`

When `src/native/shell/auth-flow.ts` changes:
1. Update iOS + Android `AuthFlowCoordinator`
2. Update `__tests__/native-auth-flow-parity.test.ts`

## Current bootstrap behavior
- loading profile/auth -> hold on splash
- unauthenticated -> phone login
- authenticated but profile incomplete -> profile completion
- authenticated + profile complete -> home tab

## Phase 1 handoff
See `NATIVE_UI_PHASE1_AUTH_SHELLS.md` for auth route transition contracts.
