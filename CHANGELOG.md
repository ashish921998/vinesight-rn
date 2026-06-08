# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-06-08

### Added
- Receipt-style activity logging — each activity (irrigation, spray, fertigation, harvest, expense, note) saves the moment you confirm it instead of staging a batch, and each row succeeds, fails, and retries on its own
- Toast notifications with clear success and error feedback across the app
- Shared empty-state and loading-state visuals that fill previously blank screens
- Add-task shortcut directly from the farm detail screen

### Changed
- Unified the app on a Material 3 design system — color, surface, radius, shadow, and font-size scales now come from shared design tokens, and the legacy color palette has been retired
- Simplified the harvest Grade and expense Category pickers to plain, calm chips (no grouping or color-coding) so they read clearly for farmers, with a single highlighted selected state
- Entry sheet now lifts above the Android keyboard and grows toward full height as chemical rows are added, with the save button pinned to the sheet bottom
- Removing a logged irrigation now subtracts only that entry's water from the live tank level, so removals stay correct across multiple irrigations regardless of the order they are removed

### Fixed
- Daily-note deletion no longer silently no-ops, and toast colors now use semantic success/error roles
- Corrected a timezone off-by-one in "days since" date math
- Receipt-log sheet height, bottom padding, CTA placement, and multi-entry state restoration when removing rows
- Dashboard now refreshes after an entry is removed
- Registered the quick log-entry route in the root navigator so it opens reliably
- Restored the circular separator dot in the logs list

## [1.2.0] - 2026-05-28

### Added
- Explore screen redesigned with dedicated Farms and Warehouse panes, compact sticky header, per-tab filter chips, and animated search expansion
- Seasonal water use displayed on farm details — shows running total vs. budget for the active season
- Farm display ordering — farms can be manually reordered and the order persists across sessions
- New `StockHealthBar` and `SeasonTimeline` visual components in the explore experience

### Changed
- Farm season bootstrap is now best-effort — failure no longer blocks farm creation
- Daily note cache invalidated on delete so the note list updates immediately
- Onboarding skip now correctly marks notifications as prompted, preventing a duplicate OS permission dialog on first launch

### Fixed
- Android safe area insets applied correctly on the onboarding screen and farm detail header
- Note rollback now correctly handles the case where no previous note existed and the upsert returned no record ID, producing a traceable rollback failure instead of a silent no-op
- Farm reorder uses an atomic transaction to prevent partial ordering state
- Negative soil water and water-depth values now display with the correct warning colour
- Water depth precision corrected for small negative values
- Daily note edits and farm ordering cache invalidated together on save
- Hindi locale strings added for farm reorder UI labels
- Overdue task label uses the correct i18n key with Hindi/Marathi translations

## [Unreleased]
