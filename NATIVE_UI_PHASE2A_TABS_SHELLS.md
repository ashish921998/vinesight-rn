# Native UI Phase 2A Tabs Shells

This file documents tabs shell navigation contracts and scaffolds for SwiftUI and Jetpack Compose.

## JS contract source
- `src/native/shell/tabs-flow.ts`
- `src/native/contracts/manifest.ts`

## Native scaffolds
- `ios-native-shell-scaffold/VineSightShell/TabsFlowCoordinator.swift`
- `android-native-shell-scaffold/app/src/main/java/com/vinesight/shell/TabsFlowCoordinator.kt`

## Tabs covered
- `home`
- `farms`
- `tools`
- `workers`
- `settings`

## Supported transitions
- `select_tab(tabId)`
- `reset_home`

## Validation
- `__tests__/native-tabs-flow-parity.test.ts`
