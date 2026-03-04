# Native UI Phase 3B Tabs UI Parity

This lane adds concrete tabs UI shells for both SwiftUI and Jetpack Compose.

## Implemented files
- `ios-native-shell-scaffold/VineSightShell/TabsShellViewModel.swift`
- `ios-native-shell-scaffold/VineSightShell/TabsShellRootView.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsShellViewModel.kt`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsShellScreen.kt`

## Tab coverage
- `home`
- `farms`
- `tools`
- `workers`
- `settings`

## Notes
- Route-to-tab mapping and transitions remain in `TabsFlowCoordinator`.
- UI shells reflect coordinator state and send tab events through view models.
