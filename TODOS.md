# TODOS

## Explore / Farms

- **Fix: `use-farms.ts` retry exhaustion throws non-Error object**
  After 3 unique-constraint retries on farm insert, `lastError` (Supabase error object) is thrown instead of an `Error` instance. Downstream `instanceof Error` checks will silently miss the message.
  **Priority:** P3

## Warehouse

- **Test: Unit tests for `warehouse-pane-b.tsx` pure functions**
  `classifyType`, `isLowStock`, and filter logic have no tests. Extract to a shared utility and add unit tests.
  **Priority:** P3

## Farm Details

- **Investigate: Post-season expense/harvest scoping**
  Expenses and harvests entered after a season end date are excluded from farm totals when the farm is between seasons, with no UI indication. Decide if this is intended and document or surface it.
  **Priority:** P3

## Add Log / Receipt Logging

- **Test: Component coverage for receipt-screen water restore across multiple irrigations**
  `ReceiptLogScreen` save→remove water-restore logic is verified correct by manual trace but has no automated test. Add a component/integration test that saves two irrigations then removes the earlier one, asserting the final `updateWaterLevel` value (later irrigations are not wiped). Complements the new `use-save-single-log.test.tsx` unit coverage of the delta math.
  **Priority:** P2

- **Test: Component coverage for receipt-screen note replace-in-place + restore**
  Saving a daily note, re-editing, saving again, then removing the row should restore the original pre-session text (or delete via the farm_id+date fallback when none existed). The underlying delete fallback is covered by `use-delete-daily-note.test.tsx`, but the screen-level replace/restore flow is untested.
  **Priority:** P2

## Spray Compliance

- **Design: One-time explanation for the harvest-status flip**
  When the fail-closed harvest fix ships, ~97% of farms flip from "Safe to harvest <date>" to "not yet verified." The calm amber state + self-explaining copy cover the core, but a one-time inline note / dismissible tip the first time the new unverified state appears ("We now flag sprays we can't verify — here's why") would prevent the "did the app break?" reaction.
  **Why:** smooths a mass visible behavior change across nearly the whole user base.
  **Depends on:** the fail-closed fix shipping (eng-review T1) + the new card states (design DT1). Needs a persisted "seen" flag.
  **Priority:** P3

## Completed

- Farm display order implemented and migration landed — v1.2.0 (2026-05-28)
- Explore screen redesigned with farms+warehouse panes — v1.2.0 (2026-05-28)
- Seasonal water use shown on farm details — v1.2.0 (2026-05-28)
- Note rollback null-guard fix — v1.2.0 (2026-05-28)
- Android safe area polish — v1.2.0 (2026-05-28)
- Onboarding skip notification permission fix — v1.2.0 (2026-05-28)
