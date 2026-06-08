# Vinesight Context

## Activity stack

An Activity stack is the set of pending log drafts a user reviews and saves together from the entry form. It can target one farm, or all farms when the stack contains only expense logs. Saving an Activity stack is intended to be atomic: if any draft fails, created records from that save attempt should be rolled back before the user retries. Rollback failures are tracked as `EntryLogRollbackFailure` objects (see `save-entry-log-session.ts`) so failures are traceable rather than silent no-ops.

## Per-entry (receipt) logging

The receipt Add-Log screen (`receipt-log-screen.tsx`) is a second save path that coexists with the batch Activity stack. Instead of staging drafts and committing them as one atomic batch, it saves each activity the moment the user confirms it, via `useSaveSingleLog` — each row succeeds, fails, and retries on its own, with no all-or-nothing rollback. Both paths share the same form-data → DB-record mapping (`submitEntryPendingLog`: water-level updates, PHI metadata, nutrient totals), so a single save and a batch save go through identical record logic. For irrigation, a saved entry records the exact amount it added to the farm's live tank level (`waterDelta`, clamped at tank capacity) so removing that one entry restores only its own water — correct across multiple irrigations regardless of removal order.
