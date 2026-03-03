# Native UI Phase 0 Contracts

This file documents the contract source used by platform-native shells.

## Source of truth
- `src/native/contracts/manifest.ts`
- `src/native/contracts/types.ts`

## Why this exists
Phase 0 needs iOS (SwiftUI) and Android (Jetpack Compose) shells to implement the same auth/session,
navigation, and analytics interfaces before full screen migration starts.

## Contract coverage
- platform framework assertions
- tab shell contract
- boot routes for auth and home
- analytics required events/user properties
- required auth session fields

## Validation
- `__tests__/native-ui-contracts.test.ts`

Update the manifest in small, versioned increments. Breaking changes require version bump and migration notes.
