# VineSight Design System — "Cellar Ledger"

Warm earth tones, shadow-minimal cards, border-led surfaces. Calm, dense,
utility-first. This file is the source of truth for design tokens and the
decisions behind them. Tokens live in [`src/styles/theme.ts`](src/styles/theme.ts).

> **Golden rule:** reference a token, never a raw number. A literal `borderRadius: 12`
> or `fontSize: 14` in a component is a bug — it bypasses the system and breaks
> consistency, dark mode, and accessibility scaling. ESLint warns on these.

---

## Design tokens at a glance

| Token group | Export | Adoption today | Notes |
|---|---|---|---|
| Spacing | `spacing` | ~82% ✅ | 4-based scale, healthy. |
| Border radius | `radius` / `componentRadius` | **100% ✅** | Deduped scale + semantic layer. Zero raw literals remain (src + app). |
| Font size | `fontSize` | **100% ✅** | Snapped to the scale (added `2xs:10`, `5xl:48`). Zero raw literals in production code. |
| Color | `colors` / `m3.colorScheme` | dual systems | M3 is dark-aware; legacy `colors` needs care. |
| Shadow | `shadows` | ~5% ⚠️ | Defined but rarely used; hardcoded all over. |

---

## Radius

### The scale (`radius`)

Every rung is a **distinct value — no aliases**. Reach for `componentRadius`
first; use a raw rung only for a genuine one-off.

| Rung | px | Use for |
|---|---|---|
| `none` | 0 | square edges |
| `xs` | 4 | inline tags, tiny insets |
| `sm` | 8 | chips, badges, segmented controls, image thumbnails |
| `md` | 12 | dense controls, small inset surfaces |
| `lg` | 16 | **inputs, buttons, cards, list tiles (default surface radius)** |
| `xl` | 24 | modals, bottom sheets, hero surfaces |
| `2xl` | 28 | large feature surfaces |
| `full` | 9999 | pills, avatars, circular FABs |

### The semantic layer (`componentRadius`) — prefer this

Reference **intent**, not a number. Change a value here once and every matching
element updates.

| Token | → | px | Applies to |
|---|---|---|---|
| `componentRadius.input` | `radius.lg` | 16 | text fields, selects, steppers, search bars, chat composer |
| `componentRadius.button` | `radius.lg` | 16 | all buttons |
| `componentRadius.card` | `radius.lg` | 16 | content cards, list tiles |
| `componentRadius.tile` | `radius.lg` | 16 | grid tiles |
| `componentRadius.sheet` | `radius.xl` | 24 | bottom sheets |
| `componentRadius.modal` | `radius.xl` | 24 | modals |
| `componentRadius.chip` | `radius.sm` | 8 | filter chips, tags, badges |
| `componentRadius.badge` | `radius.sm` | 8 | badges |
| `componentRadius.pill` | `radius.full` | — | pill controls |
| `componentRadius.avatar` | `radius.full` | — | circular avatars |
| `componentRadius.fab` | `radius.full` | — | circular FABs |

### The decision (2026-06-04)

- **Controls (inputs + buttons) are 16px.** They previously split between 12px
  (add-log form, `form-components` save button) and 24px (auth `Input`, chat
  composer). Unified to **16 (`lg`)** — the middle ground.
- **Cards are also 16px.** Radius no longer distinguishes a control from a card;
  hierarchy leans on **elevation, border, and size** instead. Sheets/modals step
  up to **24 (`xl`)** to keep one clear level of separation.
- **Why not keep 24 on the chat composer?** Consistency won. If the composer
  should read as a rounder "pill," switch it to `componentRadius.pill`, not a
  raw `24`.

### Why there's still a `borderRadius` export (deprecated)

The old `borderRadius` scale had four dead aliases (`lg`==`xl`==24,
`3xl`==`4xl`==32, `pill`==`full`) and had been silently rescaled once, so old
literals no longer matched their token names. We **froze `borderRadius` at its
historical values** (so existing call sites render identically) and marked it
`@deprecated`. Migrate usages to `radius.*` / `componentRadius.*`, then delete a
rung once it has zero references. **Do not renumber `borderRadius`** — that's the
mistake that caused the drift in the first place.

---

## Typography

Use the `fontSize` scale (`xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 ·
3xl 30 · 4xl 36`) and `fontWeight`, or the `m3.typography.*` roles
(`headlineSmall`, `titleMedium`, `bodyMedium`, `labelLarge`, `labelSmall`).

⚠️ **~92% of font sizes are currently hardcoded.** This is not cosmetic: raw
`fontSize` numbers in components are the root of the **Dynamic Type accessibility
gap** — large-text users don't get readable scaling. Migrating fontSize to tokens
fixes a real a11y bug. ESLint warns on raw `fontSize:` numbers.

---

## Color & dark mode

Two theming systems coexist:

- **`m3` / `useM3()`** — Material-3 semantic roles (`colorScheme.primary`,
  `surface.*`, `typography.*`). **Dark-aware automatically.** Prefer this.
- **`colors` / `useThemeColors()`** — the raw Cellar Ledger palette. Only safe
  via the `useThemeColors()` hook; a static `import { colors }` is **light-mode
  only and breaks in dark mode**.

**Rules**
1. New code uses `useM3()` for semantic color. Treat raw `colors` as legacy.
2. Never `import { colors }` statically for rendered UI — use `useThemeColors()`.
3. No hardcoded hex in components (decorative SVG assets like `crop-icon` excepted).
4. For state layers/opacity use `colorWithOpacity(role, n)` — but keep readable
   text at opacity ≥ 0.8 (see Accessibility).

> **Open decision:** consolidate onto M3 and retire the legacy `colors`
> surface, or keep both with strict rules? 45 files currently mix both. Tracked
> in the backlog below.

---

## Spacing & shadows

- **Spacing:** `spacing[0..24]`, 4-based. Healthy (~82% adoption). Replace stray
  literals (`padding: 16` → `spacing[4]`) opportunistically.
- **Shadows:** use `...shadows.sm|md|lg|xl|glass`. Don't hand-roll
  `shadowColor/shadowOffset/elevation`. ~95% are currently hardcoded.

---

## Enforcement

`eslint.config.js` carries a `no-restricted-syntax` guard that **warns** on raw
numeric `borderRadius` and `fontSize` literals. It's `warn` while offender files
are migrated; **flip to `error`** once `npm run lint` is clean so the system
can't regress.

---

## Migration status

**Border radius: DONE.** Deduped `radius` + semantic `componentRadius`,
retargeted M3 shape + `commonStyles`, migrated shared inputs (`Input`,
`FormField`, `InputBar`, form-components controls), and a snap-to-grid codemod
across **all of `src/` and `app/`** (~70 files). Zero raw `borderRadius` literals
remain. `entry-form` text inputs + buttons were promoted to `componentRadius`
(16) so the add-log screen matches the rest of the app. The visible changes to
spot-check on device (light + dark): inputs/chat-composer 24→16, save buttons
12→16, and snapped off-grid radii (±2–4px).

**Font size: DONE.** Scale extended with `2xs:10` (tiny-label floor) and
`5xl:48` (display). A snap-to-grid codemod tokenized every raw `fontSize` across
`src/` and `app/` (~85 sites); off-grid values rounded to the nearest rung
(ties up). Zero raw `fontSize` literals remain in production code. Spot-check on
device: small text (9/11/13/15px) shifted ±1–2px to land on the scale — verify
nothing clips in tight badges. Tests keep literal sizes (exempted from the rule).

**Guard is now `error`.** Both `borderRadius` and `fontSize` raw-number rules are
errors — production code is clean, so regressions fail `npm run lint`. Test files
(`__tests__/**`, `*.test.tsx`) are exempted (fixtures use literal values).

**Shadows: DONE.** Standard black drop shadows in the guided-tour cards,
`farm-card`, and `ConversationSidebar` now use `...shadows.*`. Colored accent
glows (button glows, the voice orb, focus rings) were intentionally left custom —
they're decorative, not elevation.

**Static `colors` dark-mode breaks: DONE.** `animated-splash.tsx` and
`activity-edit-form.tsx` now resolve color via `useThemeColors()` so they adapt
to dark mode.

**Dual M3/legacy theming: direction chosen + Phase 1 proven.** Decision: consolidate
on M3 (see [docs/theming-consolidation-proposal.md](docs/theming-consolidation-proposal.md)).
Phase 1 landed, value-preserving (zero pixel change):
- Surface ramp `m3.surface.s50…s900` added (exact dark-aware target for every legacy `colors.surface[N]`).
- New `useDomainColors()` (`src/styles/use-domain-colors.ts`) — dark-aware category/water/labTest colors.
- The `components/cards/*` group migrated off `useThemeColors` → `useM3` (proven template).
- ESLint guard (`error`) now bans the static light-only `colors`/`darkColors` import (the dark-mode-unsafe path); `src/styles/**` exempt.

Remaining (per the proposal's phases): migrate the rest of the surface-ramp consumers
by file group (forms, entry-form, screens, modals), then `primary`/`gray`, then delete
the legacy export and add the full `useThemeColors` ban. One open value-gap TODO:
`worker-card` `primary[400]/[600]` (avatar tint) has no value-equal M3 token yet (Phase 3).

---

## Design review backlog (beyond tokens)

From the 2026-06-04 full design review. Not token work, but real UX gaps.

**Interaction states (Pass 2 — 5/10)**
- ✅ **Toast system shipped** — `src/components/ui/toast.tsx` (`toast.success/error/info`,
  `<ToastHost />` mounted at root). Wired into log + task save, lab-test upload,
  water-level update, phone-link, and season-review-queued. Reuse it for other
  confirmations instead of silent single-button `Alert`s. (Alerts that carry a
  file path or multi-line instructions — e.g. report download, widget config —
  intentionally stay as dialogs.)
- ✅ **Shared `EmptyState` + `LoadingState` shipped** — `src/components/ui/empty-state.tsx`,
  `loading-state.tsx`. Wired into `farms-pane-b`, `warehouse-pane-b`,
  `worker-analytics-view`. Use these instead of re-rolling empty/loading blocks.
- ✅ **`location-picker` empty + error states** — now has a `ListEmptyComponent`
  (no-results) and an inline search-failed state instead of going blank.
- `worker-analytics`, `trends-chart`, `lab-tests` fail silently on fetch error.

**Accessibility (Pass 6 — 5/10)**
- **Dynamic Type:** hardcoded font sizes (esp. assistant components) don't scale.
  Fixed by the fontSize migration above.
- **Contrast:** secondary/muted text (`surface[500]`/`surface[400]`) sits at
  3.8–4.5:1 and opacity-stacking pushes it lower. Lift muted text to ≥4.5:1 and
  keep readable text opacity ≥ 0.8.
- **`accessibilityHint`** on only ~6 elements; vague labels ("Input action").
- Tablet/landscape unhandled (uncapped widths, no multi-pane). Lower priority.

**Information architecture (Pass 1 — 7/10)** — solid. Tools tab is a grab-bag;
consider grouping. Otherwise leave.

**AI-slop / brand (Pass 4 — 8/10)** — distinctive, not generic. The only signal
was uneven radius, which this system fixes.
