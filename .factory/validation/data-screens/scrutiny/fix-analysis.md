# Data-Screens Scrutiny: Prioritized Fix Analysis

**Round:** 1 | **Status:** fail (0/6 features passed) | **Date:** 2026-03-30

---

## SECTION 1: Issues That Are REAL and Need Fixing

### Priority 1 — Tiny Fixes (1–5 lines each, can be grouped)

| # | Feature | File | Line(s) | Issue | Fix |
|---|---------|------|---------|-------|-----|
| T1 | lab-tests | `app/lab-tests.tsx` | 557, 581 | Inactive tab text uses `colors.surface[500]` (`#5C584F` in light mode) instead of stone-5 muted `#A89E92` which is `colors.surface[400]` in light mode | Change `colors.surface[500]` → `colors.surface[400]` on both lines. **2-line fix.** |
| T2 | tasks | `src/components/cards/task-row.tsx` | 106 | Completed cards dimmed to `0.6` opacity; contract requires `0.8` | Change `0.6` → `0.8`. **1-line fix.** |
| T3 | logs | `app/logs.tsx` | ~670 | Selected filter chips use per-category `chipColor` as background; VAL-LOGS-002 requires `primary` background with white text | Change `backgroundColor: isSelected ? chipColor : ...` → `backgroundColor: isSelected ? m3.colorScheme.primary : ...` and change `borderColor` similarly. **~2-line fix.** |
| T4 | spray-catalog | `app/spray-catalog.tsx` | 305 | `mix.components.slice(1)` makes the first component untappable (can't open ProductDetailSheet) | Change condition from `mix.components.length > 1` to `mix.components.length >= 1` and `slice(1)` → `slice(0)`. Or: add a separate tappable element for the first component. **~3-line fix.** |

### Priority 2 — Moderate Fixes (remove fabricated data, ~10–30 lines each)

| # | Feature | File | Line(s) | Issue | Fix |
|---|---------|------|---------|-------|-----|
| M1 | analytics | `app/analytics.tsx` | 193–200, 227–229, 255–260 | Hardcoded fake trend values: `12% vs last season`, `8%`, `3%` | **Remove** the trend indicator `<View>` blocks (the arrow + percentage rows) from all 3 summary cards. The data model doesn't provide trend data so they must not be fabricated. ~15 lines deleted per card. |
| M2 | analytics | `app/analytics.tsx` | 246–260 | "Activities Logged" card uses `analytics.recentActivity.length` (capped at ~10) | Either: (a) remove the "Activities Logged" card entirely, or (b) compute the total from the existing real analytics totals (`analytics.totalIrrigationCount + analytics.totalSprayCount + analytics.totalHarvestCount`). Option (b) is more faithful to wireframe. ~5-line fix. |
| M3 | analytics | `app/analytics.tsx` | 294–315 | Category breakdown derived from truncated `recentActivity` sample, missing expenses/fertigation | Replace `recentActivity.reduce(...)` with real totals: use `analytics.totalIrrigationCount`, `analytics.totalSprayCount`, `analytics.totalHarvestCount`, and `analytics.expenseTotal` (as count). Also add fertigation if available. ~20 lines changed. |
| M4 | analytics | `app/analytics.tsx` | 182, 199, 217, 224, 246, 291, 312–315 + locale files | New labels missing from locale files; hardcoded English strings `tons`, `entries`, `Irrigation`, `vs last season` | Add keys to `src/i18n/locales/en.ts`, `hi.ts`, `mr.ts`. Replace hardcoded strings with `t(...)` calls. ~20–30 lines across 4 files. |
| M5 | spray-catalog | `app/spray-catalog.tsx` | 102 | All badges hardcoded to `'Fungicide'` | **Remove the type badge entirely** since `ChemicalMix`/`ChemicalMixComponent` types have no `chemicalType` field. Delete the badge `<View>` and `getTypeBadgeStyle()`. ~40 lines deleted. |
| M6 | spray-catalog | `app/spray-catalog.tsx` | 144–155 + 268–283 | PHI warning banner treats any `phi_days > 0` as "PHI active" | **Remove the warning banner** (the `hasPhiWarning` + amber banner block). Keep the neutral `PHI: {X} days` info text that already renders in the info row. `phi_days` is catalog metadata, not a live safety state. ~20 lines deleted. |

### Priority 3 — Substantial Rework

| # | Feature | File(s) | Issue | Scope |
|---|---------|---------|-------|-------|
| S1 | tasks | `app/tasks.tsx` | Completed tasks in a separate "Completed" tab instead of an in-screen collapsible section with toggle arrow + pill count badge (VAL-TASKS-003) | **Significant rework.** Must: (1) remove the completed tab from the segmented control, (2) add a collapsible "Completed (N)" section at the bottom of the main task list with a toggle arrow and count badge, (3) render completed tasks inline with 0.8 opacity. Estimated ~80–120 lines changed. |
| S2 | workers-attendance | `src/components/screens/attendance-subcomponents/mark-attendance-tab.tsx` | Entire mark-attendance UI needs redesign: single-worker date-range grid → per-date worker list with Full/Half/Absent pill toggles (VAL-ATTEND-001), arrow-based date navigator (VAL-ATTEND-002), always-visible "Mark All Present" sticky CTA (VAL-ATTEND-003) | **Major rework.** The attendance tab was never redesigned—the worker only styled the workers list card. This is essentially a full feature build for the attendance UI. Estimated ~200–400 lines changed/rewritten. |

---

## SECTION 2: Issues That Are Overly Strict / False Positives

| # | Feature | Issue | Verdict | Reasoning |
|---|---------|-------|---------|-----------|
| F1 | logs | Date headers use `toLocaleDateString('en-GB')` instead of locale-aware formatting (line 1123) | **Non-blocking / dismiss** | Flagged as `non_blocking` by scrutiny itself. Low priority cosmetic i18n issue. |
| F2 | tasks | Summary bar hardcodes English `pending`, `due today`, `overdue` (line 335) | **Non-blocking / dismiss** | Flagged as `non_blocking`. i18n regression but not part of the visual contract assertions. |
| F3 | tasks | New `tasks.sections.*` keys only in en.ts, missing from hi.ts/mr.ts (line 507) | **Non-blocking / dismiss** | Flagged as `non_blocking`. Same i18n category—should be fixed eventually but not a blocking visual issue. |
| F4 | All features | Transcript didn't evidence reading AGENTS.md / dark wireframes | **Process observation / dismiss** | These are `sharedStateObservations` about worker procedure adherence, not code bugs. They don't require code fixes. |

---

## SECTION 3: Recommended Fix Grouping

### Fix Group A: "Quick Wins" (T1 + T2 + T3 + T4)
**Scope:** 4 tiny changes across 4 files  
**Effort:** ~15 minutes  
**Files:** `app/lab-tests.tsx`, `src/components/cards/task-row.tsx`, `app/logs.tsx`, `app/spray-catalog.tsx`  
**Can be one commit.**

### Fix Group B: "Analytics Data Integrity" (M1 + M2 + M3 + M4)
**Scope:** Remove fabricated trends, fix category breakdown data source, add locale entries  
**Effort:** ~1–2 hours  
**Files:** `app/analytics.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/hi.ts`, `src/i18n/locales/mr.ts`  
**Should be one focused commit.**

### Fix Group C: "Spray Catalog Cleanup" (M5 + M6)
**Scope:** Remove fabricated chemical type badge and false PHI warning banner  
**Effort:** ~30 minutes  
**Files:** `app/spray-catalog.tsx`  
**One commit.**

### Fix Group D: "Tasks Completed Section" (S1)
**Scope:** Replace separate completed tab with in-screen collapsible section  
**Effort:** ~2–3 hours  
**Files:** `app/tasks.tsx`  
**Separate feature commit required.**

### Fix Group E: "Attendance Redesign" (S2)
**Scope:** Full redesign of mark-attendance UI to match wireframes  
**Effort:** ~4–8 hours (essentially a new feature)  
**Files:** `src/components/screens/attendance-subcomponents/mark-attendance-tab.tsx`  
**Must be a separate feature/commit. Consider assigning as a dedicated worker task.**

---

## Execution Order Recommendation

1. **Group A** (quick wins) — unblocks 3 features immediately (lab-tests, part of tasks, part of logs)
2. **Group C** (spray catalog) — unblocks spray-catalog feature
3. **Group B** (analytics) — unblocks analytics feature  
4. **Group D** (tasks collapsible) — unblocks tasks feature completely
5. **Group E** (attendance redesign) — unblocks workers-and-attendance feature (largest effort)

**After Groups A–C:** 3 features should pass re-validation (lab-tests, logs, spray-catalog)  
**After Group D:** tasks should pass  
**After Group E:** workers-and-attendance should pass  
**Analytics** depends on decisions about what data is actually available for the summary cards.
