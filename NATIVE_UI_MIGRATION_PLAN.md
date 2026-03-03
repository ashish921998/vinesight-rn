# Native UI Migration Plan (SwiftUI + Jetpack Compose)

## Goal
Migrate product UI from React Native rendering to fully native rendering:
- iOS: SwiftUI
- Android: Jetpack Compose

This is a staged replacement strategy, not a toggle. React Native will remain during transition and be removed at the end.

## Current UI Inventory
Audit snapshot from this repository:
- `app/*.tsx`: 54 route screens/layouts
- `src/**/*.tsx`: 75 components/screens/features
- `components/widgets/**/*.tsx`: 13 dashboard widget components
- Native widget targets already native:
  - iOS widget: SwiftUI (`targets/vineyard-widget/*.swift`)
  - Android widget: Compose/Glance (migrated in plugin)

## Non-Negotiable Constraint
A React Native screen cannot also be a SwiftUI/Compose screen at runtime. For full native UI, each screen must be reimplemented natively and mounted through native navigation.

## Migration Strategy
Use a strangler pattern with domain-by-domain replacement.

### Phase 0: Foundation (1-2 weeks)
Deliverables:
- Native app shells with navigation parity:
  - iOS: SwiftUI `NavigationStack` + tab shell
  - Android: Compose Navigation + tab shell
- Shared contracts for API, auth state, localization, analytics events
- UI token mapping for Material 3 (Android) and Apple HIG semantics (iOS)
- Build pipeline updates for dual targets

Exit criteria:
- Login + tab shell loads natively on both platforms
- Analytics and crash reporting work in native flows

### Phase 1: Auth + Onboarding (1-2 weeks)
Scope:
- `app/(auth)/*`
- `app/onboarding.tsx`

Deliverables:
- Native login/OTP/profile completion flows
- Native form validation and error states

Exit criteria:
- RN auth screens no longer reachable in production builds

### Phase 2: Home + Farm Core (2-3 weeks)
Scope:
- `app/(tabs)/index.tsx`
- `app/(tabs)/farms.tsx`
- `app/farm/[id].tsx`
- `app/farm/add.tsx`
- `app/farm/[id]/edit.tsx`
- Card primitives from `src/components/cards/*`

Deliverables:
- Native dashboard and farm list/details/edit
- Native equivalents for shared card patterns

Exit criteria:
- Farm discovery and CRUD complete in native flows

### Phase 3: Logs + Forms (3-4 weeks)
Scope:
- `app/add-entry.tsx`, `app/log-entry/*`, `app/logs.tsx`
- `src/components/forms/*`
- `src/components/screens/entry-form*`

Deliverables:
- Native dynamic log forms (irrigation, spray, fertigation, expense, harvest)
- Native offline queue and retry UX

Exit criteria:
- Core daily logging can run with RN logging screens disabled

### Phase 4: Workforce + Tasks + Warehouse (2-3 weeks)
Scope:
- `app/(tabs)/workers.tsx`, `app/add-worker.tsx`, `app/worker-analytics/[id].tsx`
- `app/tasks.tsx`, `app/add-task.tsx`
- `app/warehouse.tsx`, `app/add-stock.tsx`, `app/add-warehouse-item.tsx`
- `src/components/modals/*worker*`

Deliverables:
- Native worker lifecycle, attendance, settlements
- Native tasks and warehouse CRUD

Exit criteria:
- Operations workflows fully native

### Phase 5: Reports + Analytics + Tools (2-3 weeks)
Scope:
- `app/reports.tsx`, `app/analytics.tsx`
- `app/weather.tsx`, `app/soil-trends.tsx`, `app/petiole-trends.tsx`
- `app/calculator/*`, `app/spray-safe-checker.tsx`, `app/water-level.tsx`

Deliverables:
- Native charting and report export surfaces
- Native calculator and assistant tool flows

Exit criteria:
- Decision-support surfaces native with performance parity or better

### Phase 6: RN Decommission (1-2 weeks)
Deliverables:
- Remove RN route bindings and dead TSX screens
- Remove RN-only UI dependencies that are no longer used
- Final QA pass + accessibility/performance audit

Exit criteria:
- No production user path depends on RN UI rendering

## Engineering Decisions Required
1. Code sharing model for business logic:
   - Option A: Keep TS business logic and bridge calls from native
   - Option B: Rebuild domain logic in Kotlin/Swift
2. Navigation source of truth during hybrid period
3. Localization ownership (keep i18n JSON vs platform-native strings)
4. Testing split (Detox + XCTest + Espresso/Macrobenchmark)

## Quality Gates Per Phase
- Functional parity checklist complete
- Accessibility baseline pass (dynamic text, screen readers, contrast)
- Performance baseline:
  - app start and screen transition time tracked before/after
- Crash-free and key funnel metrics non-regressive for one release window

## Rough Program Estimate
- End-to-end: 10-16 weeks for one focused cross-platform team
- Highest risk areas:
  - Dynamic forms and validation parity
  - Offline queue and conflict handling UX
  - Charts/reports parity across platforms

## Immediate Next Actions
1. Approve architecture decisions (logic sharing + navigation + i18n)
2. Start Phase 0 scaffolding branch
3. Track work through linked issues/epic
