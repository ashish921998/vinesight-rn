# TODOS

## Known follow-ups (post v0.0.1.0)

- [ ] F8: Ledger rate column shows first record's rate when a settlement period contains multiple per-day rate overrides — totals are correct but the displayed rate is misleading. Fix: detect mixed rates and omit the "× ₹rate" text rather than showing a single representative rate.
- [ ] Test coverage: currently at 30% (18/61 test paths). Target is 40%. Add unit tests for `worker-analytics.ts`, `worker-card.tsx`, `worker-settlement-modal.tsx`, and the new `worker-detail/[id].tsx` screen.
- [ ] Ledger: empty `attendance_details` (no attendance in the selected period) allows a ₹0 settlement to be confirmed. Consider blocking `setIsCalculated(true)` when `attendance_details` is empty and surfacing a "No attendance in this period" message instead.
