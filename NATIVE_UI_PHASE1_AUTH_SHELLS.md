# Native UI Phase 1 Auth Shells

This file documents the Phase 1 auth migration boundary for SwiftUI and Jetpack Compose.

## JS contract source
- `src/native/shell/auth-flow.ts`
- `src/native/contracts/manifest.ts` (auth route IDs)

## Native scaffolds
- `ios-native-shell-scaffold/VineSightShell/AuthFlowCoordinator.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/AuthFlowCoordinator.kt`

## Supported transitions
- `restart` -> `auth.phone_login`
- `login_requested` -> `auth.login`
- `phone_login_requested` -> `auth.phone_login`
- `otp_sent` from login routes -> `auth.otp_verification`
- `otp_verified(hasCompleteProfile=false)` -> `auth.profile_completion`
- `otp_verified(hasCompleteProfile=true)` -> `tabs.home`

## Validation
- `__tests__/native-auth-flow-parity.test.ts`
