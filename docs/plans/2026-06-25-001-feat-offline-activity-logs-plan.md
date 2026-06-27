---
title: "feat: Offline-first farm activity logs (read + full CRUD)"
type: feat
status: draft
date: 2026-06-25
---

# feat: Offline-first farm activity logs (read + full CRUD)

## Overview

Make the six farm activity log types — irrigation, spray, fertigation, harvest, expense, and daily notes — fully usable with no internet connection: a farmer can open the app in the field, **read** their recent logs, and **create, edit, and delete** logs, with every write queued durably and synced automatically when connectivity returns.

This is scoped to activity logs only. The rest of the app (catalogs, consultant tooling, settings, AI features) continues to require a connection. The work deliberately reuses the existing TanStack Query + AsyncStorage persistence layer rather than introducing a heavyweight offline database.

## Goals

- Reads of all six log types work offline from the last-synced snapshot.
- Create / edit / delete of all six log types work offline, including **editing or deleting a record that was itself created while offline**.
- Queued writes survive an app restart and replay in order when the device reconnects.
- Writes are **idempotent** — a replay or double-flush never duplicates a record.
- The UI clearly distinguishes synced / pending / failed states, and surfaces a deferred sync failure without silently losing data.

## Non-goals (this iteration)

- Offline creation of **farms** or **seasons** (logs reference an existing, already-synced `farm_id`; `season_id` is assigned by a DB trigger — see below).
- The **consultant / delegated-log** path (`create_delegated_log` and friends in `src/services/delegated-logs.ts`) — it routes through RPCs and has different ownership semantics. Out of scope for v1.
- Real-time multi-device conflict merging beyond last-write-wins.
- Offline media/attachment upload.

## Current State (what already exists)

- **TanStack Query v5 is the only server-state layer.** All log reads/writes go through hooks in `src/hooks/use-records.ts`. There is no Redux/SWR/RTK-Query.
- **Read persistence is already wired.** `src/lib/query-cache.ts` builds a `QueryClient` and an `AsyncStorage` persister; `app/_layout.tsx` wraps the tree in `PersistQueryClientProvider`. The whole query cache is serialized to `AsyncStorage` and rehydrated on launch, so the last-fetched logs already display before any network call. `gcTime` / persister `maxAge` is **24h** (`QUERY_CACHE_MAX_AGE_MS`).
- **No connectivity detection** anywhere — `@react-native-community/netinfo` / `expo-network` are not installed.
- **No write queue, no optimistic updates.** Mutations call `supabase.from(...).insert/update/delete()` directly and only `invalidateQueries` on success (`use-records.ts`). Offline, a write just throws.
- **Schema facts** (verified against the live DB, project `ibczxoiaonssyzsybebu`):
  - All six tables have **server-assigned `bigint` primary keys** (`nextval(...)` sequences; `daily_notes` uses identity). No client-generatable id.
  - The five event tables (irrigation/spray/fertigation/harvest/expense) have **no natural/business key** — they are identified only by the surrogate `id`. `daily_notes` has a `UNIQUE(farm_id, date)` and already upserts on it.
  - Every table has a `BEFORE INSERT/UPDATE` trigger **`trg_assign_season_id`** — the database assigns `season_id`.
  - **No server-side validation triggers** (no PHI/harvest-safety triggers) and **no `user_id` column**; row ownership is enforced via `farm_id → farms`. PHI is computed app-side in `src/utils/entry-log-submission.ts` and already degrades to `phi_status='legacy_unverified'` / `[PHI_UNAVAILABLE]` when catalog data is missing.
  - FKs: `farm_id → farms`, `season_id → farm_seasons`, `spray.catalog_mix_id → chemical_mixes`, `acting_organization_id → organizations`.

### Why these facts matter

- The `season_id` trigger means **offline creates need no client-side season resolution** — the existing `resolveOrCreateSeasonIdForDate` call in each create hook runs at *sync* time (when the paused mutation resumes online), and the trigger is a backstop. No nested offline dependency.
- No validation triggers + no required `user_id` means a queued write will almost always **succeed at flush**. The realistic failure modes are: (a) the identity problem below, (b) auth token fully expired after a long offline period, (c) the irrigation water-level side effect.

## The core problem: stable identity for offline-created records

Because the five event tables have only a server-assigned `bigint` id, a record created offline has **no id until it syncs**. If the user then edits or deletes that record before sync, the edit/delete has nothing real to target (`.eq('id', …)` would reference an id the server has never seen). This is the entire difficulty of "full CRUD offline," and it forces an architectural choice.

### Decision: add a client-generated `client_uuid` (stable handle), not temp-id reconciliation

**Chosen approach — Option A.** Add a nullable `client_uuid uuid` column with a unique index to the five event tables. The client generates the UUID at creation time (online or offline) and uses it as the durable handle for that record everywhere: optimistic cache entries, edits, and deletes all key off `client_uuid`, never the bigint id.

- **Create** → `upsert(..., { onConflict: 'client_uuid' })`. Idempotent and replay-safe; the server still returns its `id`.
- **Edit / Delete of an offline-created record** → target `.eq('client_uuid', uuid)` instead of `.eq('id', id)`. Works whether or not the create has synced yet, provided the create flushes first (FIFO ordering, below, guarantees this).
- The bigint `id` is still read from the server for synced records and used for editing/deleting **already-synced** records (cheaper, and avoids touching the hot path for the common online case). `client_uuid` is the fallback handle whenever a real id isn't yet known.

`daily_notes` needs **no new column** — it already has the `UNIQUE(farm_id, date)` business key and upserts on it, which is inherently offline-safe and idempotent.

**Rejected alternatives:**
- *Option B — pure client-side temp-id → real-id reconciliation (no migration).* Offline creates get a temporary negative id; a persisted map rewrites the id of queued edits/deletes at flush. Rejected: the variable-rewriting + strict-ordering orchestration is the most bug-prone part of offline sync, it is not idempotent (a double-flush duplicates), and it must re-implement what a unique business key gives us for free.
- *WatermelonDB / PowerSync / Legend-State.* Full offline-first engines. Rejected for this scope: they require modeling the whole schema into a local DB and a much larger migration, when we only need offline behavior for one feature and already own a working persisted query cache.

## Design

### 1. Connectivity → `onlineManager`

Add `@react-native-community/netinfo` and bind it to TanStack's global `onlineManager` once at startup:

```ts
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)))
);
```

With default `networkMode: 'online'`, when `onlineManager` reports offline a triggered mutation runs `onMutate` (so the optimistic update applies immediately) and then **pauses** before its `mutationFn`. When connectivity returns, `onlineManager` automatically resumes paused mutations **sequentially in insertion order**.

> ⚠️ **Native rebuild required.** NetInfo is a native module — it cannot ship as an OTA EAS Update. It must go in an `eas build` (this aligns with the current `posthog-code/expo-sdk-56-eas-observe` branch work). `expo-network` is an alternative already in the Expo ecosystem but still requires a rebuild; NetInfo is the canonical pairing with `onlineManager` and reports reachability, so it is the recommendation.

### 2. Durable queue: stable mutation keys + `setMutationDefaults`

A paused mutation is persisted by the existing persister (`dehydrate` keeps `state.isPaused` mutations by default — to be verified during implementation, and set explicitly via `dehydrateOptions.shouldDehydrateMutation` if needed). But a function cannot be serialized, so after a cold start the replay engine needs to reconstruct the `mutationFn` from the persisted `mutationKey` + `variables`. Register defaults once at startup:

```ts
queryClient.setMutationDefaults(['activityLog', 'save'], { mutationFn: saveActivityLog });
queryClient.setMutationDefaults(['activityLog', 'update'], { mutationFn: updateActivityLog });
queryClient.setMutationDefaults(['activityLog', 'delete'], { mutationFn: deleteActivityLog });
```

On restore, resume once:

```ts
<PersistQueryClientProvider
  persistOptions={{ persister: queryPersister, maxAge: LOG_CACHE_MAX_AGE_MS }}
  onSuccess={() => queryClient.resumePausedMutations()}
>
```

### 3. One mutation per log (not per low-level table call) — handles the irrigation water-level atomic

Today `useSaveSingleLog` (`src/features/entry-log-session/use-save-single-log.ts`) orchestrates several sub-mutations and, for irrigation, performs a **read-modify-write on `farms.remaining_water`** with a compensating delete (`entry-log-submission.ts:99–138`). That orchestration lives in a hook, not in a single `mutationFn`, so it cannot be queued as one durable unit.

**Refactor:** introduce a single `saveActivityLog` mutation whose variables are `{ clientUuid, type, formData, farmContext, dateStr }` and whose `mutationFn` internally runs the existing per-type submit logic. The queued unit becomes "save this one log," replayed atomically-ish at flush. `onMutate` optimistically inserts the record (with `clientUuid` and a `pendingSync` flag) into the relevant `listByFarm` cache, and for irrigation also adjusts the farm's cached `remaining_water`.

**Water-level correctness offline:** the current code computes an *absolute* new `remaining_water` from a possibly-stale value. At flush time the real value may have changed (another irrigation synced first), so sending an absolute value would clobber. Switch the water-level update to a **delta applied server-side** via an RPC, e.g.:

```sql
-- add_remaining_water(farm_id bigint, delta numeric)
update farms
set remaining_water = least(total_tank_capacity, greatest(0, coalesce(remaining_water,0) + delta))
where id = farm_id;
```

The mutation stores `waterDelta` (already computed in `use-save-single-log.ts:121–128`) and applies it via the RPC at flush, so multiple offline irrigations compose correctly regardless of sync order.

### 4. Edit / delete by `client_uuid`

Extend the update/delete mutation fns to accept either a real `id` (already-synced record) or a `client_uuid` (offline-created, maybe-not-yet-synced) and target whichever is present:

```ts
const q = supabase.from(table).update(updates);
(realId ? q.eq('id', realId) : q.eq('client_uuid', clientUuid));
```

`onMutate` updates the cached record in place by `client_uuid`; delete removes it by `client_uuid`. For `daily_notes`, delete already falls back to `farm_id + date` (`use-records.ts:766–774`) — keep that.

### 5. Ordering, idempotency, conflicts

- **Ordering:** `resumePausedMutations` resumes sequentially in insertion order, so `create(A) → update(A) → delete(B)` replay in that order. This preserves the create-before-edit invariant.
- **Idempotency:** event-table creates use `upsert(onConflict: client_uuid)`; `daily_notes` upserts on `(farm_id,date)`. A replayed or double-flushed create updates the same row instead of duplicating.
- **Conflicts:** last-write-wins. For activity logs (each user owns their own farm's records, rarely edited from two devices at once) this is acceptable. Document it.

### 6. Read-path changes

- **Bump cache lifetime for logs.** 24h is too short for a multi-day offline trip. Raise persister `maxAge` (and `gcTime` for the log queries) to ~30 days so the snapshot survives. Keep `staleTime` at 5 min so online refetch still happens.
- **Graceful offline rendering.** The Logs screen should show cached data with an "offline / showing saved data" affordance instead of an error state when a background refetch fails offline. (`useQuery` keeps `data` on error, so this is a presentational tweak.)
- **Optimistic records must render.** Cards must tolerate a record with no real `id` (use `client_uuid` as the React key) and show a "pending sync" indicator.

### 7. Failure & status UX

- A small global **connectivity + pending-sync indicator** (e.g. "3 changes waiting to sync").
- **Per-record state:** synced (normal), pending (queued, subtle badge), failed (sync error — actionable).
- **Deferred-rejection handling:** a queued write's `onError` fires at *sync* time (possibly much later). On failure: roll back the optimistic cache entry (snapshot taken in `onMutate`), mark the item failed, and surface a toast/inbox entry ("Couldn't sync your irrigation log from Jun 25 — tap to retry/edit"). Never silently drop it.
- **Auth on reconnect:** a long offline period can expire the session. `autoRefreshToken` handles the common case; on a 401 at flush, pause the queue, refresh/re-auth, then `resumePausedMutations` again.

## Schema migration

Additive and non-breaking (nullable column + index, concurrently). Applied via Supabase migration:

```sql
-- For each of: irrigation_records, spray_records, fertigation_records,
-- harvest_records, expense_records
alter table <t> add column if not exists client_uuid uuid;
create unique index concurrently if not exists <t>_client_uuid_key
  on <t> (client_uuid) where client_uuid is not null;
-- daily_notes: no change (already UNIQUE(farm_id, date))
```

No backfill needed — existing rows keep `client_uuid = null` and are edited/deleted by their real `id` as today. Regenerate `src/types/database.ts` types after migration.

## Rollout

1. Ship the **schema migration** first (additive; safe with the old app running).
2. Ship the **client** behind a feature flag (PostHog) — `offline_activity_logs`. NetInfo requires a **native EAS build**; coordinate with the in-flight SDK/EAS work on the current branch. The write-queue + optimistic + UI changes can otherwise ride OTA, but the NetInfo dependency forces a build, so plan a build for the whole feature.
3. Enable for internal testers, verify on a real device with airplane mode, then ramp.

## Testing strategy

- **Unit:** `saveActivityLog` per type (including irrigation water-delta), update/delete targeting by `client_uuid` vs `id`, the dehydrate/hydrate of paused mutations.
- **Integration (offline simulation):** drive `onlineManager.setOnline(false)`; assert mutations pause, optimistic cache updates, then `setOnline(true)` flushes in order and reconciles ids. Cover the create→edit→delete-while-offline chain.
- **Idempotency:** force a double resume; assert no duplicate rows (upsert).
- **Restart durability:** dehydrate after queuing offline, rebuild the client from persisted state, assert `resumePausedMutations` replays.
- **Manual device QA:** airplane mode → log all six types → edit + delete some → re-enable network → verify server state + UI.

## Phasing / milestones

- **M0 — Read robustness (small, OTA-able alone aside from NetInfo).** Bump cache lifetime; graceful offline UI; add NetInfo + `onlineManager` + connectivity indicator. Ships read-offline confidence.
- **M1 — Schema + idempotent creates.** Migration; `client_uuid` generation; `saveActivityLog` single-mutation refactor with optimistic create; offline create + auto-sync for all six types. (Edits/deletes of offline-created records still restricted.)
- **M2 — Full offline edit/delete.** Update/delete by `client_uuid`; FIFO replay ordering; water-level delta RPC.
- **M3 — Status & failure UX.** Pending/failed badges, deferred-rejection surfacing, auth-on-reconnect, retry affordance.

## Risks & open questions

- **Persisted mutation replay is the riskiest mechanism.** Confirm v5 dehydrates paused mutations by default and that `setMutationDefaults` correctly rehydrates the `mutationFn` by key after a cold start; pin behavior with tests before relying on it.
- **NetInfo "connected" ≠ "Supabase reachable."** Captive portals / dead backends can report connected. Consider a reachability ping or treat repeated flush failures as offline.
- **Long-lived optimistic records** that repeatedly fail to sync need a clear escape hatch (edit, retry, or discard) so they don't accumulate invisibly.
- **`catalog_mix_id` for sprays** assumes chemical-mix reference data is already cached locally; if a farmer references a mix not in cache, PHI degrades to "unavailable" (already handled) — confirm that path is acceptable offline.
- Should the pending-sync queue be **user-visible as a list** ("Outbox") for transparency, or just per-record badges? (Product decision.)

## Key files to touch

- `src/lib/query-cache.ts` — `onlineManager` binding, `setMutationDefaults`, raise `maxAge`/`gcTime`.
- `app/_layout.tsx` — `PersistQueryClientProvider` `onSuccess: resumePausedMutations`, connectivity indicator mount.
- `src/hooks/use-records.ts` — update/delete fns accept `client_uuid`; creates upsert on `client_uuid`.
- `src/features/entry-log-session/use-save-single-log.ts` + `src/utils/entry-log-submission.ts` — fold into the single `saveActivityLog` mutation; water-level delta RPC.
- New: `src/features/offline/` — `onlineManager` setup, `saveActivityLog`/`updateActivityLog`/`deleteActivityLog` mutation fns, `client_uuid` helpers, outbox/status hooks.
- New Supabase migration — `client_uuid` columns + indexes; `add_remaining_water` RPC.
- `src/types/database.ts` — regenerated after migration.
- Card components (`src/components/cards/*`) + Logs screen (`app/logs.tsx`) — pending/failed states, key by `client_uuid`.

## Eng-review amendments (2026-06-25)

Decisions from `/plan-eng-review`. These supersede the conflicting parts of the body above.

**1. Water-level update → idempotent AFTER INSERT trigger (supersedes the `add_remaining_water` delta-RPC in §3).**
The proposed delta RPC is not idempotent — the offline queue replays writes (reconnect retry, relaunch, restore), so `remaining_water += delta` double-counts and silently corrupts the tank level. Instead, an `AFTER INSERT` trigger on `irrigation_records` applies the clamped delta `least(capacity, remaining_water + duration*system_discharge)`. Because creates upsert on `client_uuid`, a replay becomes an `ON CONFLICT` **update** — which does not refire the INSERT trigger — so the water effect applies exactly once. One source of truth, no second client write. Mirrors the existing `trg_assign_season_id` pattern. *(Prior learning: `receipt-log-per-entry-undo-vs-shared-state`.)*

**2. Offline sprays must resolve PHI offline (was under-specified; "PHI degrades gracefully" was wrong given fail-closed).**
PHI is computed at form-capture from the chemical catalog (`entry-log-submission.ts:177-202`). Offline the catalog is absent, so a spray saves with `safe_harvest_date = null`; the aggregate now **fails closed** (`phi-service.ts:191-209`), so one offline spray flips the whole season to `unverified`, and nothing re-resolves it after sync. Fix: **cache `chemical_mixes`/components + PHI rules locally** so the existing PHI calc runs offline at capture, **plus a sync-time re-resolve** against current rules as a backstop (catches stale-catalog drift). Keeps the offline field user *and* the compliance promise. *(Prior learning: `phi-aggregate-fail-open`.)*

**3. Season assignment — correct the mechanism; cache `farm_seasons` and resolve offline (supersedes "the trigger handles it, no offline season work").**
The trigger only maps a record to an **existing** season window and (post-2026-06-18 fix) sets `season_id` null when none exists — it does **not** create seasons. Creation is `resolveOrCreateSeasonIdForDate` (`season-context.ts:143`), which is network-bound and writes a `farm_seasons` row; its `seasonIdCache` (`:51`) is in-memory only. A null `season_id` drops offline records out of season-scoped views — and because the harvest-safety aggregate is queried **by season**, an offline spray with null `season_id` is uncounted, re-opening a fail-open path (couples to #2). Fix: **cache `farm_seasons` locally and resolve season offline at capture**, with `recomputeSeasonAssignmentsClient` (`season-context.ts:191`) as the post-sync backstop. *(Prior learning: `assign-season-id-insert-p0001-400`, 10/10.)*

**4. One write path (updates the §Non-goals).** Consolidate to the receipt single-save flow (`use-save-single-log.ts`); retire/redirect the legacy batch entry points (`app/add-activity.tsx`, `EntryForm`, `save-entry-log-session.ts`). The batch flow's `rollbackCreatedRecords` (delete-on-partial-failure) is an online concept that does not map to a deferred queue. Single offline-aware write path.

**5. Refactor record hooks to a factory first (make-the-change-easy, then change).** `use-records.ts` has the create/update/delete logic copied six times (~900 lines). Collapse into a generic `makeRecordHooks(table, keys)` **before** adding offline behavior, so `client_uuid`/upsert/optimistic/edit-by-client_uuid logic is written once, not in 18 hand-edited functions. **Mandatory regression tests:** existing online create/update/delete must behave identically before/after.

**6. Dead-letter / needs-attention state for poisoned writes.** A write the server rejects every flush (deleted farm, changed validation, missing target row) must not retry forever or vanish. After N bounded retries, move it to a persisted "needs attention" list with the payload preserved and explicit **retry / edit / discard** actions. Offline apps must never silently lose a write.

**7. Full enumerated test suite (supersedes the one-paragraph §Testing).** Bake all ~38 paths from the review coverage map into the plan: unit (optimistic, upsert idempotency, offline PHI, offline season), **12 integration/E2E transition tests** (offline→persist→kill→relaunch→reconnect→flush→reconcile; create→edit→delete-offline chain; replay-no-double-count; FIFO ordering), and **2 mandatory regressions** (factory refactor #5, water-level trigger #1). Needs an `onlineManager` offline/online integration harness.

**8. Batch invalidation on flush.** Per-mutation `invalidateQueries` causes N list refetches when a large queue drains on reconnect. Suppress per-mutation invalidation during a flush (flush-in-progress flag); invalidate once when `resumePausedMutations` completes.

**9. Scope the persister + move to MMKV.** Whole-cache persistence on a 1s throttle, now carrying 30 days of logs + the cached catalog + seasons, produces multi-MB AsyncStorage rewrites that jank low-end Android. Add a `dehydrateOptions`/`shouldDehydrateQuery` allowlist (logs + catalog + seasons + the mutation queue) and swap the persister storage to `react-native-mmkv` (synchronous, built for frequent writes).

## Outside-voice amendments (Codex, 2026-06-25)

Independent review caught items the section pass missed. All accepted.

**C1 — `client_uuid` must use a FULL unique index, not partial.** A partial `UNIQUE … WHERE client_uuid IS NOT NULL` generally cannot be targeted by supabase-js `onConflict: 'client_uuid'` (no predicate passed). Use a plain `UNIQUE` index — Postgres already permits multiple NULLs, so existing rows are fine. (Supersedes the `WHERE client_uuid IS NOT NULL` in the migration sketch.)

**C2 — Create replay must be insert-once (`ON CONFLICT DO NOTHING`), not `DO UPDATE`.** `DO UPDATE` makes a replayed create overwrite a *later* edit with the original payload after crash/relaunch timing — a lost update, not idempotency. Use `DO NOTHING` for creates, and **compact create+edit in the queue before flush** so the final state wins. (This is the fix that keeps amendment #1's trigger idempotency valid: a replay stays an INSERT-that-does-nothing, never refiring the trigger.)

**C3 — Water-level triggers must cover UPDATE and DELETE, not just INSERT.** Offline edit of duration / delete of an irrigation must adjust/reverse `remaining_water`. Store each irrigation's applied delta on the row; triggers on INSERT/UPDATE/DELETE maintain the level (add / apply difference / subtract). Matches prior learning `receipt-log-per-entry-undo-vs-shared-state`. (Extends amendment #1.)

**C4 — The persisted queue must be auth/session scoped.** The persister uses one global key and `resumePausedMutations()` would run while auth initialises async — pending writes can replay before auth settles, after sign-out, or under a *different* user. Scope the persist key per user id and gate resume on auth-ready; clear/park the queue on sign-out. (Closes a silent cross-user-write hole.)

**C5 — Offline PHI caching needs an explicit readiness gate.** Catalog data only exists if `useChemicalCatalog` has mounted; there is no prefetch, freshness, version, or "not offline-ready until cached" signal. Add an explicit prefetch + freshness/version stamp + an "offline-ready" indicator so a spray is only logged offline-with-PHI when the catalog is actually present and current. (Makes amendment #2 concrete.)

**C6 — Narrow the write-path consolidation (do NOT retire EntryForm).** `EntryForm` also powers task creation, voice-AI prefill, source-task linkage, all-farms expense, onboarding completion, and farm-log modal routing. Route only its **log submission** through the offline-aware receipt save; leave the component and its other roles intact. (Supersedes amendment #4's "retire EntryForm".)

**C7 — "It's an outbox now" (acknowledged, kept).** The amendments amount to an outbox built on paused mutations. Decision: keep the paused-mutation queue for v1 because C2/C3/C4 defuse the overload and TanStack's persisted paused-mutation replay is a serviceable outbox at this scale. If implementation hits its limits, escalate to an explicit domain-outbox (TanStack for reads only) — captured as an escalation path, not v1 work.

## NOT in scope

- **Delegated / agronomist offline path** — the strategically-primary offline user (per the business design doc); deferred to Phase 2 and tracked in `TODOS.md`. Reuses the same six tables + `client_uuid`/queue model via the delegated RPCs.
- **Explicit domain outbox** — deferred escalation path (Codex C7); only if the paused-mutation queue proves insufficient.
- **Wholesale retirement of `EntryForm`** — narrowed to the log-submit path only (C6); its other roles stay.
- **Offline creation of farms / seasons whose window doesn't yet exist** — such records settle `season_id` at sync via `recomputeSeasonAssignmentsClient`.
- **Multi-device conflict merging beyond last-write-wins.**
- **Offline media / attachment upload.**

## What already exists (reuse, don't rebuild)

- **TanStack Query + AsyncStorage persister** (`PersistQueryClientProvider`, `query-cache.ts`) — REUSE for offline reads and the durable paused-mutation queue.
- **`resolveOrCreateSeasonIdForDate` + `recomputeSeasonAssignmentsClient`** (`season-context.ts`) — REUSE for season resolution/backstop; do not rebuild.
- **PHI service** (`computeEarliestSafeHarvest`, the PHI calc) — REUSE offline; only its catalog inputs need caching.
- **Receipt single-save flow** (`use-save-single-log.ts`) — REUSE as the one offline-aware write path.
- **`trg_assign_season_id` trigger pattern** — REUSE the pattern for the water-level triggers.
- **`daily_notes UNIQUE(farm_id, date)`** — REUSE as the natural offline key (no `client_uuid` needed for notes).
- **Rejected rebuilds:** local SQLite / WatermelonDB / PowerSync; a custom temp-id reconciler (client_uuid supersedes).

## Failure modes (new codepaths)

| Failure | Test | Error handling | User sees | Status |
|---|---|---|---|---|
| Water delta double-counts on replay | replay-no-double-count | `DO NOTHING` + INSERT-only trigger | correct level | Closed by C2/C3 |
| Create replay overwrites later edit | create→edit→replay | `DO NOTHING` + queue compaction | edit preserved | Closed by C2 |
| Queue replays under wrong user | cross-user resume | auth-scoped key + resume gate | nothing leaks | **Critical if unbuilt** → closed by C4 |
| Offline spray uncounted (null season) | aggregate-counts-offline-spray | offline season resolve + recompute | season stays correct | **Critical if unbuilt (fail-open)** → closed by #3 |
| Poisoned write lost or loops | N-fail→dead-letter | bounded retries + resolve UI | "needs attention" item | **Critical if unbuilt (data loss)** → closed by #6 |
| Offline spray unverified | offline-PHI verified/miss | fail-closed + sync re-resolve | "unverified" (not silent) | Closed by #2/C5 |
| NetInfo connected but backend down | flush-failure→offline | treat repeated flush failure as offline | retry later | Partial — open risk |

Three potential critical gaps (silent cross-user write, fail-open season, poisoned-write loss); all closed by the amended plan. 0 remaining if built as specified.

## Parallelization

| Step | Modules | Depends on |
|---|---|---|
| A. Migrations (C1 index, C3 water triggers) | supabase/migrations | — |
| B. Record-hook factory (Issue 5) | src/hooks/use-records.ts | — |
| C. Offline core (onlineManager, DO NOTHING, compaction, auth-scope, batch-invalidate, MMKV) | src/lib, src/features/offline | A, B |
| D. Domain caches (offline PHI C5, season cache) | src/lib/season-context, catalog hooks | A |
| E. UI (dead-letter resolve, connectivity indicator, badges, offline read states) | src/components, app/logs.tsx | C |

- `Lane 1: A → C` (migrations gate the upsert/trigger code)
- `Lane 2: B → C` (factory before offline write logic lands in it)
- `Lane 3: D` (parallel to C; shares only the migration)
- `Lane 4: E` (after C establishes the mutation/queue shape)
- **Launch A + B + D in parallel worktrees; converge on C; then E.** Tests (Issue 7) span all lanes.
- **Conflict flag:** B and C both rewrite the write path — do B (factory) first, then layer offline in C, to avoid a merge collision in `use-records.ts`.

## Implementation Tasks

Synthesized from the review. Each derives from a finding above.

- [ ] **T1 (P1)** — migrations — full `UNIQUE(client_uuid)` index on the 5 event tables; regen `database.ts`. _(Codex C1)_
- [ ] **T2 (P1)** — DB — per-row applied water delta + INSERT/UPDATE/DELETE triggers maintaining `remaining_water`. _(Issue 1, Codex C3)_
- [ ] **T3 (P1)** — offline core — creates upsert `ON CONFLICT DO NOTHING`; create+edit queue compaction. _(Codex C2)_
- [ ] **T4 (P1)** — domain cache — prefetch/persist catalog + PHI rules with freshness/version + offline-ready gate; offline PHI at capture; sync re-resolve. _(Issue 2, Codex C5)_
- [ ] **T5 (P1)** — offline core — per-user persist key; gate `resumePausedMutations` on auth-ready; park queue on sign-out. _(Codex C4)_
- [ ] **T6 (P2)** — season — cache `farm_seasons`; resolve offline at capture; `recomputeSeasonAssignmentsClient` post-sync. _(Issue 3)_
- [ ] **T7 (P2)** — hooks — `makeRecordHooks` factory; offline logic once; **regression tests** (online parity). _(Issue 5)_
- [ ] **T8 (P2)** — forms — route `EntryForm` log-submit through the offline-aware receipt save; keep its other roles. _(Issue 4, Codex C6)_
- [ ] **T9 (P2)** — offline UX — dead-letter/needs-attention state + retry/edit/discard UI; bounded retries. _(Issue 6)_
- [ ] **T10 (P2)** — offline core — NetInfo↔`onlineManager`, `setMutationDefaults`, resume-on-hydrate, connectivity indicator, graceful offline reads. _(core)_
- [ ] **T11 (P2)** — offline core — suppress per-mutation invalidation during flush; invalidate once on drain. _(Issue 8)_
- [ ] **T12 (P2)** — persistence — `shouldDehydrateQuery` allowlist + MMKV persister. _(Issue 9)_
- [ ] **T13 (P1)** — tests — full suite: unit + 12 integration/E2E transitions + 2 regressions (factory, water trigger). _(Issue 7)_
- [ ] **T14 (P3)** — persistence — raise log-query `maxAge`/`gcTime` to ~30 days. _(read robustness)_

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 7 findings, all folded (C1–C7) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open→resolved | 9 issues (4 arch, 2 quality, 2 perf, 1 test/38 paths); 2 regressions mandated; all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** 7 outside-voice findings, all accepted — 2 concrete bugs (partial-index upsert, create-replay lost-update), 1 hole in the Issue 1 fix (water edit/delete), auth-scoped queue, PHI readiness gate, EntryForm blast radius, and the outbox framing (kept paused-mutation for v1 with fixes).
- **CROSS-MODEL:** Eng review and Codex converged on scope risk (the create-only/outbox concern) and on idempotency being the load-bearing problem; Codex's repo-level reading sharpened three specific decisions (#3, #6, #7).
- **VERDICT:** ENG REVIEW CLEARED — scope accepted as written (full CRUD, six types, farmer path); 9 review + 7 outside-voice findings all resolved into the plan; 0 critical gaps remaining if built as specified. Ready to implement.

NO UNRESOLVED DECISIONS
