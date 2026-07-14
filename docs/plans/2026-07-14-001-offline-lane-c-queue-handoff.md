# Handoff: Offline Lane C — the paused-mutation queue

**For:** a fresh implementation session with no prior context.
**Parent plan:** `docs/plans/2026-06-25-001-feat-offline-activity-logs-plan.md` (read its
"Eng-review amendments" and "Outside-voice amendments" sections — they supersede the body).
**Mission:** make activity-log writes actually work offline: capture while disconnected,
persist across app kills, replay safely on reconnect. Lanes A+B (schema + write primitives)
shipped in PR #250 (merge `77a2bea4`, 2026-07-14). Lane C is the queue itself.

---

## Current state (verified 2026-07-14, main @ 77a2bea4)

### Shipped and trustworthy — build on these, do not rewrite

- `src/features/offline/client-id.ts` — `newClientUuid()` (Math.random v4, documented
  dedup-not-security), `isClientUuid()`.
- `src/features/offline/record-writes.ts` — the three primitives with their invariants:
  - `idempotentCreate(table, record)` — upsert `ON CONFLICT (client_uuid) DO NOTHING`
    (`ignoreDuplicates`), then farm-scoped `maybeSingle` read-back. Throws a descriptive
    error if the conflicting uuid lives outside the payload's farm. **A replayed create can
    never duplicate a row, clobber a later edit, or return another farm's row.**
  - `targetedUpdate` / `targetedDelete` — address by `id`, OR by `clientUuid` + `farmId`
    together. A `clientUuid` ref without `farmId` throws. **Never weaken this: client_uuid
    is guessable, farm scope is the containment.**
- `src/features/offline/record-hooks-factory.ts` — `makeRecordWriteHooks` generates
  create/update/delete hooks for the five event tables (wired in `src/hooks/use-records.ts`).
  - `useCreate` stamps `client_uuid` into the mutation **variables** in its
    `mutate`/`mutateAsync` wrappers (capture time). Variables are what TanStack persists,
    so a rehydrated mutation replays with the same identity. `mutationFn` never mints uuids.
  - `onSuccess` invalidates `listByFarm`, `reports.unassignedRecordCount(farmId)`, and
    (irrigation only) `lists()`. This parity was hand-verified against the 15 old hooks —
    keep it when adding queue behavior.
- `src/features/offline/compaction.ts` — `compactQueuedOps` pure function, fully tested,
  **currently imported by nothing**. Wiring it into the flush is part of this lane.
- Schema: `client_uuid uuid` + full unique index `<table>_client_uuid_key` live in prod on
  all five event tables (migration `20260625031809`, applied). `daily_notes` deliberately
  has no client_uuid — its natural key `UNIQUE(farm_id, date)` is already idempotent.
- Tests: `__tests__/offline-*.{ts,tsx}` (52 tests), shared Supabase chain mock in
  `jest-setup/supabase-chain-mock.ts` (helpers can NOT live in `__tests__/` — jest's default
  testMatch collects every file there as a suite).

### Not built (this lane's work)

- No NetInfo, no `onlineManager` wiring. **`@react-native-community/netinfo` is NOT installed.**
- No `mutationKey` / `setMutationDefaults` anywhere; paused mutations cannot rehydrate.
- Persister (`src/lib/query-cache.ts`): AsyncStorage, single global key
  `VINESIGHT_REACT_QUERY_CACHE`, maxAge 24h, 1s throttle, **no dehydrateOptions allowlist,
  not auth-scoped**. Mounted at `app/_layout.tsx:706` with **no `onSuccess`** (so no
  `resumePausedMutations`). **`react-native-mmkv` is NOT installed.**
- Global mutation `retry: 1` (`src/lib/query-cache.ts:17`) — relevant to replay semantics.
- No pending/failed sync UI, no dead-letter state.

---

## Tasks (from the parent plan; IDs are the plan's)

### T10 — connectivity + queue skeleton (do first, everything hangs off it)
1. `npx expo install @react-native-community/netinfo` (native module → needs a dev build,
   not OTA-able; see Rollout).
2. `src/features/offline/online-manager.ts`: subscribe NetInfo →
   `onlineManager.setOnline(...)`. Treat `isInternetReachable === false` as offline;
   plan risk: NetInfo "connected" ≠ Supabase reachable — treat repeated flush failures
   as offline (cheap version: flip `onlineManager` off after N consecutive flush failures).
3. Stable `mutationKey` per (table, op) — e.g. `['record-write', table, 'create']` — set via
   `queryClient.setMutationDefaults(key, { mutationFn })` in a module that runs at startup
   (import it from `src/lib/query-cache.ts` or `_layout.tsx`), so rehydrated mutations can
   find their functions after a cold start. The factory's inline `mutationFn` moves there;
   the hooks reference the key.
4. `PersistQueryClientProvider onSuccess={() => queryClient.resumePausedMutations()}` —
   but GATED, see T5.
5. Connectivity indicator (small badge/banner; `app/_layout.tsx` mount).

### T5 — auth-scope the queue (P1; closes the plan's "critical if unbuilt" cross-user hole, Codex C4)
- Persist key must include the user id: `VINESIGHT_REACT_QUERY_CACHE:<userId>`.
  Auth lives in `src/stores/auth-store.ts` (zustand; `onAuthStateChange` at :127).
- Gate `resumePausedMutations()` on auth-ready AND same-user: do not resume while the
  session is still initializing; on sign-out, park (do not flush, do not drop silently)
  the queue; on sign-in as a different user, never replay the previous user's writes.

### T3 remainder — wire compaction into the flush
- Before `resumePausedMutations()` drains, read the paused mutations, map to
  `CompactableOp` (`uuid:<client_uuid>` handle for offline-created, `id:<id>` otherwise),
  run `compactQueuedOps`, and replay the compacted set. The pure function is done and
  tested; this task is the adapter around TanStack's mutation cache.
- If adapting paused mutations in place proves fragile, the plan's C7 escape hatch is an
  explicit domain outbox (TanStack for reads only) — escalate, don't force it.

### T11 — batch invalidation on flush
- Per-mutation `onSuccess` invalidation × N queued writes = N refetch storms on reconnect.
  Suppress per-mutation invalidation while a flush is in progress (module-level flag the
  factory's `onSuccess` checks), then invalidate the affected list keys once when
  `resumePausedMutations()` resolves. Normal per-mutation invalidation outside a flush
  must be untouched (tests pin it).

### T12 — persistence hygiene
- `dehydrateOptions.shouldDehydrateQuery` allowlist: logs + catalog + seasons queries and
  the mutation queue. Today the whole cache serializes every second.
- Swap the persister to `react-native-mmkv` (sync, built for frequent writes; also a native
  module → same dev-build train as NetInfo).

### Also in scope (small)
- Swap `newClientUuid()` internals to `expo-crypto` `Crypto.randomUUID()` (expo-crypto is
  already an Expo SDK dep; call sites unchanged — the docblock anticipates this).
- Map the `idempotentCreate` foreign-farm read-back error to a typed error so the queue can
  dead-letter it instead of retrying forever (full dead-letter UX is T9/lane E, but the
  error TYPE belongs here so the queue is built against it).

---

## Settled decisions — do not relitigate (see parent plan amendments)

- Creates replay as `DO NOTHING` + read-back, never `DO UPDATE` (C2 — a replay must not
  overwrite a later edit). Compaction-before-flush is the companion piece.
- Paused-mutation queue for v1, not a custom outbox (C7 — escalation path documented).
- `daily_notes` uses its natural key; no client_uuid anywhere for notes.
- One write path: the receipt single-save flow (`use-save-single-log.ts`); `EntryForm`
  keeps its other roles, only its log-submit routes through the offline-aware save (C6).
- Water-level correctness = idempotent DB triggers (INSERT/UPDATE/DELETE, per-row applied
  delta), NOT a client delta RPC (amendment 1 + C3). That migration (T2) is **not yet
  written** — it's lane-A follow-on work; the queue must not compensate client-side.

## Gotchas that already bit us

- **This session-history: PR #180 merged into a stale stacked base branch and never reached
  main.** If you stack PRs, delete the base branch the moment it merges.
- Migration files here don't always match remote versions (migrations are applied via MCP,
  files committed after). Check `supabase_migrations.schema_migrations` before assuming a
  local file needs applying. `20260625031809` is applied.
- Global mutation `retry: 1` interacts with everything you build: an ambiguous first attempt
  retries once. Idempotency now holds (capture-time uuid + DO NOTHING), but any NEW mutation
  type you add must be replay-safe under retry too.
- Season resolution (`resolveOrCreateSeasonIdForDate`) runs inside `mutationFn` and is
  network-bound: an offline create FAILS at season resolution before it can pause. Either
  pre-resolve at capture from a cached `farm_seasons` (T6, lane D — coordinate) or make the
  mutationFn tolerate offline by queueing with `season_id: null` + post-sync
  `recomputeSeasonAssignmentsClient` (the plan's documented backstop). Decide explicitly;
  don't let it fail silently.
- NetInfo + MMKV are native modules: this lane needs a full EAS build (`eas build`), not an
  OTA update. Bundle them in one dev-build cycle.

## Test requirements (the plan's T13 names ~12 integration transitions)

Minimum for this lane: offline create → pause → kill → relaunch → rehydrate → reconnect →
flush → reconcile; create→edit→delete-offline chain compacts to nothing; replay does not
double-insert (uuid stable across rehydration); cross-user resume never replays user A's
writes under user B; flush suppresses per-mutation invalidation and fires one batch
invalidation; foreign-farm read-back error dead-letters rather than loops. An
`onlineManager` test harness (flip online/offline in jest) is prerequisite — build it first.

## Verification loop

`npm run typecheck && npm run lint && npm test -- --ci` (1,840 tests green at handoff).
Manual: airplane-mode create on a dev build, kill app, relaunch, disable airplane mode,
confirm single row in Supabase (`select * from irrigation_records order by id desc limit 5`
via MCP, project `ibczxoiaonssyzsybebu`).

## Out of scope for this lane

Delegated/agronomist path (Phase 2, TODOS.md), dead-letter resolve UI + badges (lane E),
offline PHI catalog + season caches (lane D, but coordinate on the season gotcha above),
water-level trigger migration (T2), `maxAge` raise to 30 days (T14, trivial — do it with T12).
