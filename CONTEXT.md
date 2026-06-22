# Vinesight Context

## Activity stack

An Activity stack is the set of pending log drafts a user reviews and saves together from the entry form. It can target one farm, or all farms when the stack contains only expense logs. Saving an Activity stack is intended to be atomic: if any draft fails, created records from that save attempt should be rolled back before the user retries. Rollback failures are tracked as `EntryLogRollbackFailure` objects (see `save-entry-log-session.ts`) so failures are traceable rather than silent no-ops.

## Per-entry (receipt) logging

The receipt Add-Log screen (`receipt-log-screen.tsx`) is a second save path that coexists with the batch Activity stack. Instead of staging drafts and committing them as one atomic batch, it saves each activity the moment the user confirms it, via `useSaveSingleLog` — each row succeeds, fails, and retries on its own, with no all-or-nothing rollback. Both paths share the same form-data → DB-record mapping (`submitEntryPendingLog`: water-level updates, PHI metadata, nutrient totals), so a single save and a batch save go through identical record logic. For irrigation, a saved entry records the exact amount it added to the farm's live tank level (`waterDelta`, clamped at tank capacity) so removing that one entry restores only its own water — correct across multiple irrigations regardless of removal order.

## Language

### Consultant workflow

The consultant-side schema (organizations, members, clients, petiole reviews, fertilizer plans) is owned by the `vinesight-web` repo; this app reads and writes it through that repo's RPCs and RLS-gated tables. These are the shared domain terms.

**Organization**:
A consulting business whose members manage farmers' farms. A farmer is an active client of at most one organization at a time.
_Avoid_: Consultancy, agency, tenant

**Organization member**:
A person inside an organization, with role owner, admin, or agronomist. Owners/admins act on every client; an agronomist acts only on clients assigned to them.
_Avoid_: Consultant (ambiguous — can read as the org or the person), staff

**Farmer**:
The end user who owns farms and records activity. Becomes a client when linked to an organization.
_Avoid_: Client (use only when emphasizing the org relationship), grower, user

**Petiole review**:
A unit of consultant work opened automatically when a farmer records a petiole test — one per organization managing that farmer. Pending until a consultant resolves it by sending a fertilizer plan.
_Avoid_: Triage (the internal/DB name), ticket, task

**Fertilizer plan**:
A consultant-authored set of fertilizer items (product, quantity, unit, optional method/frequency) plus a short message, sent to a farmer as the response to exactly one petiole review. Belongs to one review; sending it resolves the review.
_Avoid_: Recommendation (the farmer-facing synonym), schedule, prescription

**Farmer recommendation**:
The farmer-facing view of a sent fertilizer plan. Visible only to farmers linked to an organization.
_Avoid_: Advice, suggestion
