# Native UI Phase 1B Compose Auth Parity

This lane implements a concrete Jetpack Compose auth shell driven by the shared auth flow coordinator.

## Goal
Provide Compose-first auth components so Android can run native-auth screens for all Phase 1 routes:
- `auth.login`
- `auth.phone_login`
- `auth.otp_verification`
- `auth.profile_completion`

## Implemented files
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/AuthFlowViewModel.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/AuthFlowScreen.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/AuthFlowCoordinator.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/NativeRouteRegistry.kt`

## Notes
- Route transitions stay source-of-truth in `AuthFlowCoordinator`.
- `AuthFlowScreen` renders route-specific composables and forwards actions as coordinator events.
- The scaffold intentionally avoids backend coupling and keeps form state local for integration.
