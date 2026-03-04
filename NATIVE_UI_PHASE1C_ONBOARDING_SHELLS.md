# Native UI Phase 1C Onboarding Shells

This file documents onboarding flow contracts and shell scaffolds for SwiftUI and Jetpack Compose.

## JS contract source
- `src/native/shell/onboarding-flow.ts`
- `src/types/onboarding.ts`

## Native scaffolds
- `ios-native-shell-scaffold/VineSightShell/OnboardingFlowCoordinator.swift`
- `ios-native-shell-scaffold/VineSightShell/OnboardingFlowViewModel.swift`
- `ios-native-shell-scaffold/VineSightShell/OnboardingFlowRootView.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/OnboardingFlowCoordinator.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/OnboardingFlowViewModel.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/OnboardingFlowScreen.kt`

## Route outcomes
- `onboarding`
- `auth.phone_login`
- `tabs.home`

## Supported transitions
- `next`
- `previous`
- `complete`
- `reset`
- `skip_to_complete`

## Validation
- `__tests__/native-onboarding-flow-parity.test.ts`
- `NATIVE_UI_PHASE3A_ONBOARDING_UI_PARITY.md`
