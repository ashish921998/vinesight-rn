# Native UI Phase 2A Tabs Shells

This file documents tabs flow contracts and shell scaffolds for SwiftUI and Jetpack Compose.

## JS contract source
- `src/native/shell/tabs-flow.ts`

## Native scaffolds
- `ios-native-shell-scaffold/VineSightShell/TabsFlowCoordinator.swift`
- `ios-native-shell-scaffold/VineSightShell/TabsShellViewModel.swift`
- `ios-native-shell-scaffold/VineSightShell/TabsShellRootView.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsFlowCoordinator.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsShellViewModel.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsShellScreen.kt`

## Route outcomes
- `tabs.home`
- `tabs.farms`
- `tabs.tools`
- `tabs.workers`
- `tabs.settings`

## Supported transitions
- `select(tab)`
- `reset_home`

## Validation
- `__tests__/native-tabs-flow-parity.test.ts`
- `NATIVE_UI_PHASE3B_TABS_UI_PARITY.md`
