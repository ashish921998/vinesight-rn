# Architecture

## Overview
VineSight is a React Native/Expo vineyard management app. This mission redesigns its visual layer to match the "Cellar Ledger" design direction — warm earth tones, shadow-minimal cards, compact data layouts.

## Theme System
- **Entry point**: `src/styles/theme.ts` — exports color palettes, spacing, borderRadius, fontSize, fontWeight, shadows, commonStyles, and M3 semantic themes.
- **M3 layer**: `createM3Theme(isDark)` generates Material Design 3 semantic color roles (colorScheme.primary, onPrimary, surface, onSurface, etc.) and surface elevation tokens.
- **Hooks**: `src/styles/use-theme.ts` — `useThemeColors()`, `useM3()`, `useThemeTokens()`, `useIsDark()`.
- **Theme store**: `src/stores/theme-store.ts` — Zustand with AsyncStorage persistence. Modes: light/dark/system.
- **Color utility**: `src/utils/color.ts` — `colorWithOpacity(hex, opacity)` used everywhere.

## How Theme Changes Cascade
Screens access theme via hooks (`useM3()`, `useThemeColors()`). The M3 theme is built from base color palettes. **Changing the base palette values in `theme.ts` automatically cascades to every screen** that uses `m3.colorScheme.primary`, `m3.colorScheme.surface`, etc. Individual screens then need layout-level updates to match wireframe structures.

## Navigation
- **Root**: Expo Router `<Stack>` with auth, tabs, modals
- **Tabs**: 5 visible tabs (Home, Explore/Farms, Workers, Tools, Assistant) + hidden Settings/Farms
- **Stack screens**: Analytics, Logs, Tasks, Warehouse, Reports, Calculators, etc. as modal or pushed screens

## Shared Components
- `src/components/cards/` — StatsCard, QuickActionButton, ActivityLogCard, FarmCard, WorkerCard, TaskRow, etc.
- `src/components/ui/` — Button, Input, Symbol (SF Symbol/Ionicons abstraction), FormComponents
- `src/components/forms/` — Irrigation, Spray, Fertigation, Harvest, Expense forms
- `src/components/assistant/` — ChatScreen, MessageBubble, SuggestionChips, InputBar

## Styling Patterns
- **95%+ inline styles** with theme hooks — `style={{ backgroundColor: m3.colorScheme.surface }}`
- Some screens use `useMemo`-based `createStyles` factory
- No CSS-in-JS library, no NativeWind/Tailwind
- `colorWithOpacity()` for alpha transparency

## Key Invariants to Preserve
- All `useTranslation()` / `t()` calls (i18n)
- All `useSafeAreaInsets()` usage
- All `RefreshControl` patterns
- All `accessibilityRole` / `accessibilityLabel` props
- Platform branching (iOS/Android) for SF Symbols vs Ionicons
- TanStack Query data hooks and state management
- Navigation structure and route params

## Cellar Ledger Design Tokens (Target)

### Semantic Colors (Light / Dark)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #355847 | #4A8B6B | Actions, CTAs, active states |
| secondary | #A56B4F | #9A6A52 | Expense category |
| accent | #D0A14A | #C49843 | Alerts, highlights |
| info | #4E7384 | #5A8090 | Info metrics |
| warning | #C58A2B | #B88030 | Attention, PHI alerts |
| error | #B84C3A | #C45A4A | Danger, overdue |
| success | #4F7A5A | #5A8B65 | Completed, healthy |

### Surface/Neutral Colors (Light / Dark)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| bg/mist-0 | #FBF8F3 | #121613 | Screen background |
| card/mist-1 | #F7F3ED | #1A1E1B | Card surfaces |
| mist-2/surface-2 | #EEE7DD | #242A24 | Hover, dividers |
| border/stone-3 | #D9D0C4 | #2E342F | Borders |
| muted/stone-5 | #A89E92 | #7A756D | Muted text, inactive |
| bark | #5C584F | #A89E92 | Secondary text |
| ink | #1E241F | #E8E4DE | Primary text |

### Category Colors (Light / Dark)
| Category | Light | Dark |
|----------|-------|------|
| Irrigation | #3F6E78 | #5A8B96 |
| Spray | #6C7C46 | #8A9A5E |
| Harvest | #A9752F | #C48A40 |
| Labour | #7A5E8E | #9A7EAE |
| Fertigation | #56704E | #6A8A5E |
| Note/Lab | #5C6D91 | #7A8DAA |

### Typography
- Body: IBM Plex Sans (400/500/600/700)
- Display: Fraunces serif (onboarding headlines only)

### Key Patterns
- Cards: 1px solid border (stone-3), NO shadows
- Attention strips: 3px colored left border
- Icon circles: 36-44px with 10-12px radius, 12-18% opacity category-tinted bg (slightly higher opacity in dark mode)
- Metric values: tabular-nums
- Section headers: 11px/600/uppercase/0.8px letter-spacing/stone-5

### M3 Semantic Mapping Gotchas
- `m3.colorScheme.surface` / `background` = screen background (`mist-0` / `#FBF8F3`, dark `#121613`)
- `m3.surface.surfaceContainerLow` = card surface (`mist-1` / `#F7F3ED`, dark `#1A1E1B`)
- `m3.colorScheme.outline` = card border (`stone-3` / `#D9D0C4`, dark `#2E342F`)
- `m3.colorScheme.outlineVariant` = divider / hover surface (`mist-2` / `#EEE7DD`, dark `#242A24`) — **do not use for primary card borders**
- `m3.colorScheme.surfaceVariant` resolves to the lighter card bg in light mode but to dark `surface-2` (`#242A24`), so it should be treated as a hover/secondary surface, **not** the default Cellar Ledger card background in dark mode

### Dark Mode Wireframes
Workers must reference BOTH wireframe versions when implementing:
- Light: `wireframe-{name}.html`
- Dark: `wireframe-{name}-dark.html`
Both at `~/.gstack/projects/ashish921998-vinesight-rn/designs/dashboard-20260329/`
