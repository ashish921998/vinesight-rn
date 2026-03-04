# Native UI Phase 1A SwiftUI Auth Parity

This lane implements a concrete SwiftUI auth shell that is driven by the shared auth flow coordinator.

## Goal
Provide SwiftUI-first auth components so iOS can run native-auth screens for all Phase 1 routes:
- `auth.login`
- `auth.phone_login`
- `auth.otp_verification`
- `auth.profile_completion`

## Implemented files
- `ios-native-shell-scaffold/VineSightShell/AuthFlowViewModel.swift`
- `ios-native-shell-scaffold/VineSightShell/AuthFlowRootView.swift`
- `ios-native-shell-scaffold/VineSightShell/AuthFlowCoordinator.swift`
- `ios-native-shell-scaffold/VineSightShell/NativeRouteRegistry.swift`

## Notes
- Route transitions stay source-of-truth in `AuthFlowCoordinator`.
- `AuthFlowRootView` renders per-route SwiftUI screens and forwards user actions as coordinator events.
- The scaffold intentionally avoids app-specific backend wiring and keeps view state local for easy integration.
