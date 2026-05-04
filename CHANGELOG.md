# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1.0] - 2026-05-04

### Workers module redesign

**What you can now do:**
- See each worker's last 30 days of attendance at a glance — a colour-coded strip (green full day, amber half day, grey absent) appears on every worker card without opening any detail screen.
- Open a dedicated worker-detail screen showing a 30-day calendar grid, by-farm breakdown, and a direct "Settle wages" button — no longer buried in a modal flow.
- Settle wages with a ledger that shows exactly how many full and half days were worked, the rate applied, gross earnings, any advance deduction, and the net amount — before you confirm.
- Pull-to-refresh on the workers screen now refreshes attendance and transaction data alongside the roster, so totals stay current after any change.
- Period summary banner (total pending wages across all active workers) now waits for all data to load before displaying, eliminating a brief ₹0 flash during initial load.

**Fixes and reliability improvements:**
- Closing the settlement done-screen via the header X now correctly fires the parent refresh callback (previously only the Done button triggered it, leaving totals stale).
- Settlement confirmation now checks for a Supabase lookup error before reading the advance balance — prevents a silent failure from showing a misleading "deduction exceeds balance" error.
- 30-day attendance query cutoff uses local date instead of UTC, so the window boundary is correct in non-UTC timezones (e.g. IST UTC+5:30).
- Worker card footer and detail screen metrics are filtered to the 30-day window rather than all-time history.
- Settlement period dates displayed in the done-screen use local timezone formatting.
- Accessibility labels added to interactive icon buttons; misleading navigation chevron removed from worker card.
