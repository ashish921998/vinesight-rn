# Changelog

All notable changes to this project will be documented in this file.

## [1.7.1.0] - 2026-08-10

### Changed
- Activity rows on the farm detail screen now use long-press for delete instead of swipe gestures, matching the standard iOS interaction pattern. Tap to edit remains unchanged.

### Removed
- `SwipeableRow` component deleted entirely. `TimelineLogCard` simplified to a plain `Pressable` (the professional farm detail screen never used swipe actions). `SwipeableRecentActivityRow` wrapper removed; `RecentActivityRow` now accepts an `onLongPress` prop directly.

## [1.7.0.2] - 2026-08-10

### Added
- Recent-activity rows now carry a `secondaryDetail` line (irrigation moisture status, spray weather, harvest buyer/notes, expense remarks) on both the home dashboard and the farm detail screen.
- Delegated-professional attribution and a harvest-safety "unverified" advisory banner on the farm detail screen (Detailed mode, grape farms).

### Changed
- Explore farm and warehouse panes redesigned as dense compact rows with water status, day-count, stock, reorder, and price info. Filter chips removed in favor of the simplified layout.
- OTA `runtimeVersion` switched from the fingerprint policy to the appVersion policy, so native runtime changes require bumping `expo.version` and shipping a compatible binary before publishing OTA updates. Size-analysis builds use the same policy as production.
- Farm activity presentation unified across the home dashboard and farm detail via a shared `RecentActivityRow` component and `useLogPresentation` hook (now exported).

### Fixed
- Accessibility labels on explore rows now include the rendered metadata (crop variety, area, region, stage and day-count for farms; manufacturer, category, quantity, reorder, price, and expiry for warehouse items) while preserving the localized low-water and low-stock state.
- Localized accessibility labels and stock interpolation across the explore panes.
- `secondaryDetail` now populated on the home screen recent-activity list.

## [1.7.1] - 2026-07-10

### Added
- FPC activity register report (Fratelli format) for at-a-glance per-farm activity history.
- Week-strip date selector on the add-log screen, plus a repeat-last-log suggestion to speed up data entry.
- Fertilizer recommended-dose layer: prefill from catalog, range guardrail, and seed data.
- Micronutrient tier (Fe/Zn/Mn/Cu/B/Mo sources) with gram-scale nutrient ledger in the catalog.
- PostHog `isFeatureEnabled` wrapper providing kill-switch and canary gating for compliance rollouts.

### Changed
- Farmer logging paths now require an active season, with explicit between-seasons handling so users are never left logging into a void.
- Catalog collapses branded fertilizer rows and corrects mis-typed spray rows.
- The governing PHI rule now picks the strictest verified + currently-effective rule, so the safe-harvest date is never too optimistic.

## [1.7.0] - 2026-07-04

### Added
- Reports now show applied quantities through three lenses: per plot (season totals), per acre (rates), and per liter of water (spray concentration). Mass, volume, and count are kept separate — they never collapse into one misleading number.
- A plan-compliance section in reports compares what a fertilizer plan prescribed against what was actually applied, per acre. Rows are marked "verified" when the applied record was logged from that plan item, and "approximate" when matched by product name only — never presented as verified.
- Products logged in a unit the app can't convert now appear in clearly labelled "shown as logged" buckets (unrecognized unit, water volume not logged, farm area unavailable) instead of vanishing from the report.

### Fixed
- Per-acre report figures now use the area the record was applied over, so editing a farm's area later no longer rewrites what past applications look like, and the Stock Usage and per-plot sections can no longer contradict each other.
- Hectare-preference farms now convert to acres before any per-acre math, so their rates are no longer reported ~2.47× too high.
- A spray concentration or per-acre rate is never summed as if it were a plot total (30 g/L twice is no longer shown as "60 g/L").
- The per-acre lens keeps its titled header when farm area is unavailable, so the reader can tell which section is unavailable and why.

## [1.5.0] - 2026-06-21

### Added
- Delegated logging for consultants: a professional can record irrigation, spray, fertigation, harvest, and notes on behalf of a client farm, with the entry attributed to the acting professional
- Role-aware professional directory: owners and admins see every active client in the org, agronomists see only the clients assigned to them, and the directory header and empty states adapt to the role (`deriveProfessionalRole` presentation flags; authorization stays server-side)
- Consultant lab review screens: per-farm lab reports with petiole test comparison and a soil baseline panel, plus a fertilizer-plan composer that records a petiole triage and sends the plan to the farmer (`consultant-reviews` service, `use-consultant-reviews`)
- Full-fidelity delegated logs: the `create_delegated_log` RPC persists the complete record payload (PHI metadata, safe-harvest date, nutrient coverage, catalog mix) rather than a reduced subset

### Changed
- Record creation now lazily creates a farm's initial season when none exists yet (`resolveOrCreateSeasonIdForDate`), so logs are no longer saved with a null season during onboarding or on older farms

### Fixed
- Logging is faster: the save screen now closes immediately instead of waiting on a background refetch, and season-id resolution is cached per session so repeat saves to the same farm skip the extra RPC round-trip. The cache is invalidated whenever a farm's seasons change (start/end/update/recompute)
- The app entry screen no longer traps every user on a dead-end error if the professional-workspace lookup hits a transient network error; it falls through to the normal route (farmers are the common case and must never be blocked)
- Delegated log saves that return no record id now fail loudly instead of persisting an entry that can never be deleted
- Consultant soil baseline values render reliably regardless of whether the stored keys are camelCase or snake_case, and the lab-reports screen shows a clear unavailable state for a missing farm id instead of a blank screen
- The delegated farm-activity feed is now scoped to the acting organization, so a consultant cannot see delegated records created by a different organization that previously serviced the same farm (`get_delegated_farm_activity` org filter)

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

### Added
- Focused quick-log drawers on the home screen: tap an activity (irrigation, spray, harvest, expense) to log it straight to the selected farm, no full form. Irrigation carries optional fertilizers inline; spray gets catalog mixes, history/plan pickers, and a live harvest-safety (PHI) verdict.
- Date fields can show relative "Today"/"Yesterday" labels for recent-activity logs.

### Changed
- Spray/irrigation quick-log sheets open at full height and scroll cleanly; the quantity+unit field height now matches the name inputs.

### Fixed
- Picking a catalog mix no longer wipes chemical rows the user already typed — the mix's components are merged in and deduped instead.
