# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-06-21

### Added
- Delegated logging for consultants: a professional can record irrigation, spray, fertigation, harvest, and notes on behalf of a client farm, with the entry attributed to the acting professional
- Role-aware professional directory: owners and admins see every active client in the org, agronomists see only the clients assigned to them, and the directory header and empty states adapt to the role (`deriveProfessionalRole` presentation flags; authorization stays server-side)

### Changed
- Record creation now lazily creates a farm's initial season when none exists yet (`resolveOrCreateSeasonIdForDate`), so logs are no longer saved with a null season during onboarding or on older farms

### Fixed
- Logging is faster: the save screen now closes immediately instead of waiting on a background refetch, and season-id resolution is cached per session so repeat saves to the same farm skip the extra RPC round-trip. The cache is invalidated whenever a farm's seasons change (start/end/update/recompute)

## [1.4.0] - 2026-06-17

### Added
- Farmers can now self-link to a consultant's organization by entering that org's slug (the "consultant code") during profile completion or later from Settings, via a new `join_organization_by_slug` SECURITY DEFINER RPC that enforces one-active-org-per-farmer, staff≠client, and removed-stays-removed atomically
- Optional consultant-code field on the profile-completion (signup) screen, with a Settings entry point and modal for joining after signup, mirroring the existing phone-link modal

### Fixed
- Signup org-join ordering: the org join is no longer attempted if the profile save failed (duplicate email / validation), the retry gate stays closed until the farmer taps Continue (no premature redirect when editing a failed code), and the profile is refetched after a successful join so org-gated UI like Fertilizer Plans is visible on dashboard landing instead of waiting for a later refetch
- AI-gateway test fixtures are now hermetic and no longer leak real secrets from the developer shell into the test run

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
