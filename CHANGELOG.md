# Changelog

All notable changes to this project will be documented in this file.

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
