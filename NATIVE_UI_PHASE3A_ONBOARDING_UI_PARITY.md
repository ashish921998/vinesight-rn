# Native UI Phase 3A Onboarding UI Parity

This lane adds concrete onboarding UI shells for both SwiftUI and Jetpack Compose.

## Implemented files
- `ios-native-shell-scaffold/VineSightShell/OnboardingFlowViewModel.swift`
- `ios-native-shell-scaffold/VineSightShell/OnboardingFlowRootView.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/OnboardingFlowViewModel.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/OnboardingFlowScreen.kt`

## Flow coverage
- `language`
- `welcome`
- `features`
- `preferences`
- `notifications`
- `complete`

## Notes
- Transition logic remains in shared native coordinators.
- UI shells are route/step-driven and intentionally backend-agnostic for incremental integration.
