# Native UI Phase 0 Shell Scaffold

This scaffold provides starter native route registries and bootstrap router logic
that mirror the contract in `src/native/contracts`.

## Directories
- `ios-native-shell-scaffold/VineSightShell/*`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/*`

## Included artifacts
- route/tab enums for each platform shell
- bootstrap routing resolver based on auth/profile snapshot

## Contract sync rule
When `src/native/contracts/manifest.ts` changes:
1. Update `src/native/shell/route-registry.ts`
2. Update iOS + Android scaffold registries
3. Run tests:
   - `npm test -- --runInBand`

## Current bootstrap behavior
- loading profile/auth -> hold on splash
- unauthenticated -> phone login
- authenticated but profile incomplete -> profile completion
- authenticated + profile complete -> home tab
