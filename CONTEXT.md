# Vinesight Context

## Activity stack

An Activity stack is the set of pending log drafts a user reviews and saves together from the entry form. It can target one farm, or all farms when the stack contains only expense logs. Saving an Activity stack is intended to be atomic: if any draft fails, created records from that save attempt should be rolled back before the user retries. Rollback failures are tracked as `EntryLogRollbackFailure` objects (see `save-entry-log-session.ts`) so failures are traceable rather than silent no-ops.

## Per-entry (receipt) logging

The receipt Add-Log screen (`receipt-log-screen.tsx`) is a second save path that coexists with the batch Activity stack. Instead of staging drafts and committing them as one atomic batch, it saves each activity the moment the user confirms it, via `useSaveSingleLog` — each row succeeds, fails, and retries on its own, with no all-or-nothing rollback. Both paths share the same form-data → DB-record mapping (`submitEntryPendingLog`: water-level updates, PHI metadata, nutrient totals), so a single save and a batch save go through identical record logic. For irrigation, a saved entry records the exact amount it added to the farm's live tank level (`waterDelta`, clamped at tank capacity) so removing that one entry restores only its own water — correct across multiple irrigations regardless of removal order.

## Water ledger

A farm's water balance (`farms.remaining_water`) is mutated through the **water ledger** seam (`src/hooks/water-ledger.ts`). Logging an irrigation goes through the atomic `log_irrigation` RPC, which inserts the irrigation record and applies the clamped water delta in one transaction, returning the exact amount added (the `waterDelta` above). Rolling a logged irrigation back out of an Activity stack uses the `revert_irrigation` RPC, which deletes the record and subtracts that exact delta. Both compute from the row's own current value, so concurrent writers can't silently lose an update — this replaces the old client-side read-modify-write (see `docs/multi-device-write-safety.html`). The manual water-level sheet and the receipt-screen undo still set the level client-side; making those compare-and-swap is the remaining Phase-2 work.

## Worker ledger

A worker's advance balance (`workers.advance_balance`) is mutated through the **worker ledger** seam (`settleWorker` in `src/services/worker-service.ts`). Confirming a settlement goes through the atomic `settle_worker` RPC, which — in one transaction, under a row lock on the worker — inserts the settlement, records the advance-deduction and payment transactions, and decrements the advance balance computed from the row's own current value (`greatest(0, balance - deducted)`). It rejects a deduction larger than the current balance server-side, closing the read-then-write race the client pre-check alone could not. This replaces the old client-side read-modify-write of `advance_balance` plus best-effort compensating delete (same hazard class as the water ledger; see `docs/multi-device-write-safety.html`). The pure attendance rollup shown in the settlement modal lives in `summarizeSettlementLedger`.
