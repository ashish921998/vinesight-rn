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

## FPC Register / Professional Surface

- **Perf: Dated activity RPC v2 + payload measurement**
  `get_delegated_farm_activity` returns a farm's entire history as one JSONB payload; the register filters client-side. Add payload-size logging in the register hook now; build `get_delegated_farm_activity_v2(p_from, p_to)` (new function name — old builds keep working, no OTA) when any org farm exceeds ~2k records or ~1MB payload.
  **Context:** deferral decided in eng review 2026-07-09 (issue 6B + Codex #8). Fetch site: `src/services/delegated-logs.ts:294`.
  **Depends on:** FPC register shipped (measurement lands with it).
  **Priority:** P3

- **Feature: Consolidated all-farmers register export + org completeness overview**
  Org-level pull: every member farmer's register in one export (zip of CSVs or multi-section PDF) + per-farmer completeness % on the client list. Loop workspace clients→farms, reuse `generateReportData` per farm.
  **Why:** the FPC's end-state job is audit readiness across members (Codex #12); per-farm pulls stop scaling past ~10 active farmers.
  **Depends on:** per-farm register shipped; trigger = ~10 actively-logging pilot farms or Fratelli asks.
  **Priority:** P2 (post-pilot-adoption)

- **Feature: True season picker on the professional register**
  Verify professional→client `farm_seasons` RLS; if readable, add a season selector replacing the pruning→today default as the primary range.
  **Context:** deferred in eng review 2026-07-09 (D2/T2-C); the pruning-date default covers single-season pilots.
  **Depends on:** register shipped; a pilot farm with 2+ seasons of data.
  **Priority:** P3

- **Feature: True .xlsx register export (gated on Fratelli's answer)**
  Add exceljs (or similar) + styled multi-sheet xlsx export of the FPC register. Only if Fratelli answers "xlsx required" to the assignment question — their office may edit/reconcile the register rather than just file it (Codex #10).
  **Depends on:** Fratelli's reply to design-doc open question 4.
  **Priority:** P3 (pre-staged, no speculative build)

## Completed

- Farm display order implemented and migration landed — v1.2.0 (2026-05-28)
- Explore screen redesigned with farms+warehouse panes — v1.2.0 (2026-05-28)
- Seasonal water use shown on farm details — v1.2.0 (2026-05-28)
- Note rollback null-guard fix — v1.2.0 (2026-05-28)
- Android safe area polish — v1.2.0 (2026-05-28)
- Onboarding skip notification permission fix — v1.2.0 (2026-05-28)
