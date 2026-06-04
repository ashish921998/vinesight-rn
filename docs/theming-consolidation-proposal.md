# Theming Consolidation Proposal

_Analysis of the two parallel theming systems in vinesight-rn, with a decision-ready migration plan. Grounded in the code as of branch `design-review/log-entry-ux`. No source was modified to produce this document._

---

## 1. Executive summary & recommendation

The app ships **two coexisting color systems plus a third hidden one**:

1. **M3 semantic layer** (`useM3()` / `getM3Theme(isDark)`) — `m3.colorScheme.*`, `m3.surface.*`, `m3.typography.*`, `m3.shape.*`. Dark-aware, role-based. Used in **85 files**.
2. **Legacy palette** (`useThemeColors()` returning the `colors`/`darkColors` ramp) — `colors.surface[50..900]`, `colors.primary[N]`, `colors.gray[N]`, `colors.error/success/warning`, category + water colors. Used in **54 files**.
3. **(Hidden third source)** Hard-coded category hex literals in `src/constants/calculator-models.ts` (`LOG_TYPES[].color`, e.g. `#4d8573`), which is what actually colors activity/log category dots — **not** the `colors.irrigation/spray/...` keys in `theme.ts`.

**62 files mix systems 1 and 2.** Both `useThemeColors()` and `useM3()` are dark-aware, so the "two systems" problem is overwhelmingly about **consistency, duplication, and a thin layer of genuine visual conflict** — *not* a widespread dark-mode-bug fire. The classic dark-mode trap (a static `import { colors }` rendering light-only) is **essentially absent from rendered components** (see §4): the only static legacy-palette consumers are `src/styles/utils.ts` (dead code) and `src/styles/theme.ts` itself (intentional).

**Recommendation: Direction A (consolidate on M3), executed in phases, but the real work is narrower than it looks.** The legacy palette's only heavily-used capability is the **`surface[50..900]` neutral ramp (709 references across 53 files)**. The category/water/`gray` colors that look like blockers are almost entirely **unused or dead** (§3). So the plan is:

- Add the missing **surface-ramp rungs** as explicit M3 tokens (a 1:1 named mapping — no visual change), plus a small **domain-color module** for the handful of real category/status needs.
- Migrate `colors.surface[N]` → the matching `m3.surface.*` / `m3.colorScheme.*` token, file group by file group, each group independently shippable and visually verifiable.
- Delete the legacy `useThemeColors` export and lock it with an ESLint `no-restricted-syntax` guard modeled on the existing `borderRadius`/`fontSize` guard in `eslint.config.js`.

Headline numbers: **85 files on M3 · 54 on legacy · 62 mixed · 709 `colors.surface[N]` refs · 601 `colorWithOpacity` calls · 3 color sources to collapse to 1 (+1 domain module) · ~3 truly dark-mode-risky/dead spots.**

---

## 2. Inventory (measured)

| Metric | Count |
|---|---|
| Total `.ts`/`.tsx` files in `src` | 290 |
| Files using `useM3()` | 85 |
| Files using `useThemeColors()` | 54 |
| Files using `useThemeTokens()` (returns **both** `colors` + `m3`) | 15 (14 components + the hook) |
| Files mixing M3 **and** legacy palette | **62** |
| Files touching the legacy `colors.*` palette at all | 62 |
| Files referencing the `colors.surface[N]` ramp | 53 |
| Total `colors.surface[N]` occurrences | **709** |
| `colors.primary[N]` occurrences | 82 |
| `colors.gray[N]` occurrences | 36 (11 files) |
| `colors.error/success/warning/info` occurrences | ~150 across ~30 files |
| `colors.secondary[N]` / `colors.accent[N]` occurrences | 2 (one file: `warehouse-pane-b.tsx`) |
| Direct `colors.<category>` / `colors.water` / `colors.labTest` usage in components | **1 file** (`lab-test-details-modal.tsx`, `colors.labTest.soil/petiole`) |
| `colorWithOpacity(...)` call sites | **601** across 85 files |
| Static `import { colors }` into a **rendered component** | **0** |

### Static `colors` import — the dark-mode bug hunt
Scanning for the classic light-only static import in components returns **no true positives**. The seven files that *look* static (`settings/*.tsx`, `farm-form/index.tsx`) actually receive `colors` as a **prop or factory argument** (e.g. `createStyles(colors: ThemeColors, m3)` in `settings-styles.tsx`, `const { colors, m3 } = form` in `farm-form/index.tsx`) — the value is sourced upstream from a dark-aware hook. The only genuine static consumers of the raw `colors` export are:

- `src/styles/theme.ts` — intentional (builds the M3 theme from `colors`/`darkColors`).
- `src/styles/utils.ts` — `getActivityColor()` and `getWaterStatusColor()` read static light-only `colors.*`. **Both helpers have zero call sites** (dead code).

### The ~62 mixed files (representative; full list available via `useM3` ∩ `useThemeColors`)
Concentrated in: `components/forms/*` (irrigation/spray/harvest/fertigation/expense/note), `components/screens/entry-form*`, `components/screens/farm-form/*`, `components/screens/reports/*`, `components/modals/*`, `components/cards/*`, `components/ui/form-components.tsx`, plus the entire `components/assistant/*` cluster (which uses `useThemeTokens` to grab both at once). These are the migration surface.

---

## 3. Capability gap — what `colors` provides that `m3.colorScheme` does not

| Legacy capability | In M3 today? | Real-world usage | Verdict |
|---|---|---|---|
| **`surface[50..900]` neutral ramp** | Partially. `m3` exposes `surface`, `surfaceVariant`, `onSurface`, `onSurfaceVariant`, `outline`, `outlineVariant`, and `surface.surfaceContainerLowest…Highest`. But these are an **opinionated subset** with a specific light/dark mapping (see §5), not a transparent 1:1 of all ten rungs. | **709 refs / 53 files — the dominant dependency.** | **The real blocker.** Needs explicit rung tokens or a careful per-rung mapping. |
| Per-category colors (`irrigation/spray/fertigation/harvest/labour/note/observation/task/expense`) | No semantic role. `harvest[500]` is reused as `m3.colorScheme.tertiary`. | **Effectively unused** from `theme.ts`. The live category colors are hard-coded hex in `constants/calculator-models.ts` `LOG_TYPES[].color`. The `colors.<category>` keys are only read by dead `utils.ts` helpers. | **Not a blocker** — but a latent inconsistency: category color is defined in *two* places that disagree (e.g. irrigation is `#3F6E78` in `theme.ts` vs `#4d8573` in `constants`). |
| `water` status colors (`critical/low/medium/good`) | No. | Only read by dead `getWaterStatusColor()` in `utils.ts`. | **Not a blocker** (dead). Keep as domain tokens if/when water UI needs them. |
| `labTest` colors (`soil/petiole`) | No. | 1 live site: `lab-test-details-modal.tsx`. | Small — fold into a domain module. |
| `gray[50..900]` | No (deliberately — Cellar Ledger uses warm `surface`, not neutral gray). | 36 refs / 11 files. | Migrate to `surface` ramp or a small `neutral` token set. |
| `secondary[500]` / `accent[500]` | `secondary` yes (`m3.colorScheme.secondary`); `accent` no. | 2 refs, 1 file. | Trivial. |
| `error/success/warning/info` (flat) | `error`, `success`, `warning` yes as roles; `info` no. | ~150 refs. | Mostly already covered by `m3.colorScheme.{error,success,warning}`; add `info` + container roles. |

**What would need to be added to fully retire `colors`:**
1. **Surface ramp tokens** — either expose all ten dark-aware rungs on `m3` (e.g. `m3.surface.s50…s900`) or map each rung to an existing semantic token. This is the bulk of the work.
2. A **small domain-color module** (dark-aware) for: log/category colors (single-source with `constants`), water-status colors, and `labTest`. Call it `useDomainColors()`.
3. Minor role additions: `info`, `accent`, optional success/warning containers.

The headline: **"just use m3" is blocked almost entirely by the surface ramp, not by domain colors.** The domain colors are a paper tiger — mostly dead or already duplicated elsewhere.

---

## 4. Conflicts & dark-mode risk

The two systems disagree in two specific, fixable ways:

### 4.1 Surface mapping mismatch (the one to watch during migration)
`theme.ts` maps M3 surface roles like this:

```
m3.colorScheme.surface          = surface[50]   (#FBF8F3 light / #121613 dark)   ← the app background
m3.colorScheme.surfaceVariant   = surface[100]  light / surface[200] dark
m3.surface.surfaceContainerLow  = surface[100]  (#F7F3ED light / #1A1E1B dark)   ← the card color
m3.surface.surfaceContainer     = surface[200]
m3.colorScheme.outline          = surface[300]
m3.colorScheme.onSurfaceVariant = surface[500]
m3.colorScheme.onSurface        = surface[900] light / surface[800] dark (note: NOT 900 in dark)
```

Legacy code overwhelmingly paints cards with `colors.surface[100]` and borders with `colors.surface[300]`. The trap: a naïve sweep of `colors.surface[100]` → `m3.colorScheme.surface` would map the **card** color onto the **background** token (`surface[50]`), collapsing the card-vs-background contrast that the warm Cellar-Ledger palette depends on. The correct mapping is `surface[100]` → `m3.surface.surfaceContainerLow`. **This is the single highest-risk substitution and must be done per-rung, not globally.**

Per-rung target map (light/dark consistent because both come from `getThemeColors(isDark)`):

| Legacy rung | Correct M3 target |
|---|---|
| `surface[50]` | `m3.colorScheme.surface` / `m3.surface.surfaceContainerLowest` |
| `surface[100]` | `m3.surface.surfaceContainerLow` |
| `surface[200]` | `m3.surface.surfaceContainer` (or `m3.colorScheme.surfaceVariant`) |
| `surface[300]` | `m3.colorScheme.outline` / `m3.surface.surfaceContainerHigh` |
| `surface[400]` | `m3.surface.surfaceContainerHighest` (or a `muted` token) |
| `surface[500]` | `m3.colorScheme.onSurfaceVariant` |
| `surface[600/700]` | _no clean role_ — needs explicit ramp tokens |
| `surface[800]` | `m3.colorScheme.onSurface` **in dark only**; ad-hoc in light |
| `surface[900]` | `m3.colorScheme.onSurface` (light) |

The `600/700/800` rungs are where a transparent 1:1 mapping doesn't exist and the "expose all ten rungs on m3" approach is safest.

### 4.2 Category color drift (correctness bug, not theming)
Category colors are defined in **three** places that disagree:
- `theme.ts` `colors.irrigation[500]` = `#3F6E78` (light) / `#5A8B96` (dark)
- `constants/calculator-models.ts` `LOG_TYPES` irrigation = `#4d8573` (the one actually rendered)
- `styles/utils.ts` `getActivityColor()` returns the `theme.ts` value (dead).

Whichever direction we pick, **category color should collapse to one dark-aware source.** Today the rendered value (`constants`) is **not dark-aware at all** — a real (if subtle) dark-mode inconsistency that the migration can fix as a side benefit.

### 4.3 `colorWithOpacity` (601 calls)
`colorWithOpacity(color, n)` is used pervasively to fabricate state layers (pressed/hover tints) and translucent fills. M3 already defines `m3.stateLayerOpacity.{pressed,focus,hover,dragged}` but there are **no precomputed state-layer color tokens** — every call site recomputes `colorWithOpacity(role, 0.12)` by hand. This is a missing-token smell: 601 hand-rolled overlays. A small set of derived tokens (e.g. `m3.state.pressedOnSurface`, `m3.state.primaryContainerPressed`) or a `withState(role, 'pressed')` helper would retire most of them and remove magic opacity numbers. Out of scope for the core consolidation, but worth a fast-follow.

---

## 5. Directions & trade-offs

### Direction A — Consolidate on M3 (recommended)
Extend M3 with the surface ramp + a domain-color module, migrate all `useThemeColors`/`colors.*` to `m3`, delete the legacy export, lock with lint.

- **What it means:** One color entry point (`useM3()`), plus `useDomainColors()` for category/water/lab. `useThemeColors` and the raw `colors`/`darkColors` exports are removed from app code (kept private inside `theme.ts` as the M3 source of truth).
- **Pros:** Single mental model; M3 is the richer, more semantic system and already the majority (85 vs 54 files); kills the 3-way category-color drift; lint guard makes regressions impossible; aligns with the existing token-guard philosophy already in `eslint.config.js`.
- **Cons:** Touches ~62 files; the surface-ramp mapping needs care (§4.1); requires adding ramp tokens so it's not a pure deletion.
- **Effort:** ~62 files. Human: ~3–4 focused days. AI-assisted: ~0.5–1 day across phased PRs (mechanical per-rung substitution + visual diff per group).
- **Risk:** Medium, fully contained by per-rung mapping + screenshot diffing per file-group. Each phase ships independently.
- **Dark-mode impact:** Net **positive** — removes the dead light-only `utils.ts` helpers and makes category colors dark-aware for the first time. No regression if §4.1 mapping is followed.

### Direction B — Keep both, enforce a strict boundary
`m3` for all generic surfaces/text; a thin `useDomainColors()` for category/water/lab only; ban any other legacy `colors.*`; add a lint rule.

- **Pros:** Smallest immediate diff; clarifies intent; domain colors get a proper home.
- **Cons:** Still two hooks and two mental models forever; the 709 `colors.surface[N]` refs — the actual mass — would have to migrate to `m3` *anyway* to honor the boundary, so this is ~80% of Direction A's work for half the payoff (you stop just short of deleting the export). The boundary tends to erode without the hard deletion.
- **Effort:** ~55 files (everything except the genuine domain sites). Human ~3 days / AI ~0.5 day.
- **Risk:** Medium; same surface-mapping risk.
- **Dark-mode impact:** Neutral-to-positive.

### Direction C — Invert: make `colors` the single palette, `m3` a thin alias
Treat the legacy ramp as canonical and reduce `m3` to semantic aliases over it.

- **Pros:** The ramp is the most-referenced primitive (709), so "the data is already there."
- **Cons:** Throws away the richer, more semantic, already-majority M3 system and the 85 files on it; loses role semantics (`onSurface`, `outline`, containers) that make intent legible; `colorScheme` aliases over raw rungs is a step backward in expressiveness; would also need a domain module. Highest churn (touches the 85 M3 files), lowest design payoff.
- **Effort:** ~85 files. Human ~4–5 days / AI ~1 day.
- **Risk:** High (rewrites the system the design work is converging on).
- **Dark-mode impact:** Neutral.

---

## 6. Recommended plan — Direction A, phased

Rationale: lowest risk for the most consistency gain. M3 is already the majority and the more semantic system; the surface ramp is a mechanical, mappable migration; the "domain color" blocker is mostly dead code. Each phase is independently shippable and visually verifiable, and the end state is locked by a lint guard consistent with the existing `eslint.config.js` token guards.

### Phase 0 — Token foundation (no UI change)
1. Add the **surface ramp** to the M3 theme: expose all ten dark-aware rungs (e.g. `m3.surface.s50 … s900`, sourced from `getThemeColors(isDark)`), so every legacy `surface[N]` has an exact, dark-aware target — including the awkward `600/700/800` rungs.
2. Add minor roles: `info`, `accent`, any missing success/warning containers.
3. Create `src/styles/use-domain-colors.ts` → `useDomainColors()` returning dark-aware **category** colors (single-sourced — make `constants/calculator-models.ts` `LOG_TYPES[].color` read from it, killing the 3-way drift), **water** status, and **labTest** colors.
4. **Verify:** type-checks; zero rendered-pixel change (pure additions). Ship.

### Phase 1 — Kill dead code & the static risk
1. Delete `getActivityColor` / `getWaterStatusColor` from `styles/utils.ts` (zero call sites), removing the only light-only static `colors.*` rendering path.
2. Repoint `lab-test-details-modal.tsx` (`colors.labTest`) and `warehouse-pane-b.tsx` (`colors.accent/secondary`) onto `useDomainColors()` / `m3`.
3. **Verify:** `rg "colors\.(labTest|water|accent)"` returns only `theme.ts`. Ship.

### Phase 2 — Migrate the surface ramp, by file group (the bulk)
Migrate `colors.surface[N]` → the §4.1 per-rung M3 target, one group per PR, screenshot-diffing light **and** dark for each:
- **2a — `components/cards/*`** (farm-card, stats-card, task-row, worker-card, activity-log-card, quick-action-button)
- **2b — `components/forms/*`** (irrigation/spray/harvest/fertigation/expense/note/form-field) + `components/ui/form-components.tsx`
- **2c — `components/screens/entry-form*`** (entry-form.tsx + entry-form/* — highest single-file density, 33 refs in entry-form.tsx)
- **2d — `components/screens/farm-form/*`** (index + all picker sheets)
- **2e — `components/screens/reports/*` + `components/modals/*`**
- **2f — remaining screens** (task-form, soil-profile-form, warehouse-item-form, water-level-sheet, attendance-*, settings/*, trends-*, location-picker, etc.)

Per-group verification: type-check, ESLint, and a before/after screenshot in both themes on one representative screen per group. Convert each component from `useThemeColors()` (or `useThemeTokens`) to `useM3()` once its last `colors.*` ref is gone.

### Phase 3 — Migrate `primary` / `gray` / flat status colors
1. `colors.primary[N]` (82 refs) → `m3.colorScheme.primary` / `primaryContainer` / `inversePrimary` per shade.
2. `colors.gray[N]` (36 refs) → surface ramp or a `neutral` token.
3. `colors.error/success/warning` → existing `m3.colorScheme.*` roles.
4. **Verify:** `rg "\bcolors\.(primary|gray|error|success|warning|info)\b" src` empty outside `theme.ts`.

### Phase 4 — Delete the legacy export & lock it in
1. Remove `useThemeColors` and `useThemeTokens` from `use-theme.ts` (or have `useThemeTokens` return only `m3`); make `colors`/`darkColors` non-exported internals of `theme.ts`.
2. Add an ESLint guard modeled on the existing `no-restricted-syntax` `'error'` rule in `eslint.config.js` (the one banning raw `borderRadius`/`fontSize` literals). Add rules such as:
   - `ImportSpecifier[imported.name='colors']` / `'darkColors'` / `'useThemeColors'` from `@/styles/theme` / `@/styles/use-theme` → **error** with message *"Use `useM3()` (generic UI) or `useDomainColors()` (category/water/lab) — the legacy `colors` palette is retired. See docs/theming-consolidation-proposal.md."*
   - Optionally a `no-restricted-imports` entry for the same, which gives cleaner messages for imports.
   This mirrors the existing guard's structure exactly (a hard `error` rule, tests exempted via the `__tests__/**` override already present).
3. **Verify:** `npm run lint` + `tsc` clean; grep for `useThemeColors`/`colors.` returns nothing in `src` outside `theme.ts`.

### Fast-follow (optional, separate effort) — state-layer tokens
Introduce derived state-layer tokens / a `withState(role, state)` helper and migrate the **601 `colorWithOpacity` overlays** to remove the hand-rolled opacity math (§4.3). Independent of the consolidation; can be guarded the same way once stable.

---

## 7. Why A over B/C (one paragraph)
B does ~80% of A's churn (the 709 surface refs migrate either way) but stops short of the deletion that actually prevents backsliding — you keep two hooks forever. C inverts onto the *less* semantic, *minority* system and rewrites the 85 files the design system is already converging on. A is the only option that ends with **one** generic color hook, a **single dark-aware** source for category colors (fixing a real latent bug), and a **lint guard** that makes the consolidation permanent — at a churn (~62 files) that is fully containable by the phased, screenshot-verified, independently-shippable plan above.
