# Changelog

All notable changes to Vinesight are documented here.

## [1.1.0] - 2026-05-03

### Added
- **Season timeline card** on the Farms screen — shows a visual progress bar from Pruning → Bloom → Véraison → Harvest (130-day season), with milestone dots that fill as the season advances
- **Day counter** (e.g. "45d since pruning") and **today marker** on the timeline so farmers can see exactly where they are in the growing cycle at a glance
- **Harvest estimate date** computed automatically from pruning date plus 130 days, formatted in the active locale (EN/HI/MR)
- **Urgency accent** — the card's left strip and status badge turn red when a farm's water level drops below 30%; green when healthy
- **Water balance chip** with signed mm value (+42 / −15) in the stat strip
- **Farms summary line** in the list header showing total farm count, total area, and how many farms currently need attention
- Urgency-first sort so low-water farms surface to the top of the list
- New i18n keys for season milestones and summary phrases in EN, HI, and MR locales

### Fixed
- Android crash from `borderStyle: 'dashed'` with per-side border widths — replaced with a solid 1px separator View
- Stale day counter past midnight — `today` is now passed as a prop and refreshed on screen focus via `useFocusEffect`
- Harvest date displayed in Devanagari numerals on HI/MR locales — now uses `formatDate()` with `-u-nu-latn` Unicode extension
- Area display regressed to raw unformatted number — restored `formatNumber()` with 1-decimal and Latin digits
- TypeScript type error: `FarmsSummaryLine` style prop typed as `ViewStyle` but passed to `<Text>` (now `TextStyle`)

### Changed
- `FarmCard` wrapped in `React.memo`; `renderFarm` and action handlers stabilized with `useCallback` for FlatList render performance

## Completed

