# VineSight Offline Architecture

This document summarises the full offline-first architecture implemented across eight phases. It covers how data is read, written, synced, and recovered when the device has no network connectivity.

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 – Foundation](#phase-1--foundation)
3. [Phase 2 – Offline Reads](#phase-2--offline-reads)
4. [Phase 3 – Offline Writes & Sync Queue](#phase-3--offline-writes--sync-queue)
5. [Phase 4 – Conflict Resolution](#phase-4--conflict-resolution)
6. [Phase 5 – Offline Media / Asset Caching](#phase-5--offline-media--asset-caching)
7. [Phase 6 – Offline-First UI/UX Indicators](#phase-6--offline-first-uiux-indicators)
8. [Phase 7 – Background Sync & Periodic Refresh](#phase-7--background-sync--periodic-refresh)
9. [Phase 8 – Testing, Monitoring & Hardening](#phase-8--testing-monitoring--hardening)
10. [How to Test](#how-to-test)
11. [Known Limitations](#known-limitations)

---

## Overview

VineSight uses an **offline-first** approach so that vineyard managers can continue logging activities, viewing farm data, and managing workers even when they are in areas with poor or no connectivity. The architecture is layered:

```
┌─────────────────────────────────────────────┐
│  UI Layer (React Native / Expo Router)      │
├─────────────────────────────────────────────┤
│  Hooks (TanStack Query + custom hooks)      │
├─────────────────────────────────────────────┤
│  Sync Queue  │  Conflict Resolver  │ Cache  │
├─────────────────────────────────────────────┤
│  Background Sync Service                    │
├─────────────────────────────────────────────┤
│  Circuit Breaker  │  Offline Logger         │
├─────────────────────────────────────────────┤
│  Supabase (remote)  │  AsyncStorage (local) │
└─────────────────────────────────────────────┘
```

---

## Phase 1 – Foundation

**PR #37**

Established the base infrastructure:

- Installed `@react-native-community/netinfo` for network detection.
- Set up TanStack Query with offline-aware defaults (stale times, retry policies).
- Created the Supabase client with secure token storage (`expo-secure-store` on native, `AsyncStorage` on web).

---

## Phase 2 – Offline Reads

**PR #40**

Enabled reading data while offline:

- **PowerSync integration** (`src/lib/powersync/`) – local SQLite replica that syncs with Supabase.
- **Offline hooks** (`use-offline-farms`, `use-offline-farm-seasons`, `use-offline-profile`) – read from the local replica when offline, fall back to Supabase when online.
- Schema definition in `src/lib/powersync/schema.ts`.

---

## Phase 3 – Offline Writes & Sync Queue

**PR (Phase 3)**

Allowed creating and updating records while offline:

- **Sync Store** (`src/stores/sync-store.ts`) – Zustand store tracking every pending mutation (id, status, retries, error).
- **Offline mutations hook** (`src/hooks/use-offline-mutations.ts`) – wraps Supabase mutations; queues them locally when offline.
- **Pending sync badge** (`src/components/ui/pending-sync-badge.tsx`) – shows the number of unsynced items.

---

## Phase 4 – Conflict Resolution

**PR #47**

Handles the case where the same record is edited both locally and on the server:

- **Conflict Resolution Service** (`src/services/conflict-resolution-service.ts`):
  - `detectFieldConflicts()` – compares local, server, and base records field-by-field.
  - `resolveLastWriteWins()` – most recent `updated_at` wins.
  - `resolveMerge()` – merges non-overlapping changes; escalates true conflicts.
  - `handleConflict()` – main entry point called during sync upload.
- **Conflict Store** (`src/stores/conflict-store.ts`) – persists unresolved conflicts.
- **Conflict Modal** (`src/components/modals/conflict-resolution-modal.tsx`) – lets the user manually resolve field-level conflicts.
- **Types** (`src/types/conflict.ts`) – `SyncConflict`, `FieldConflict`, `ConflictResolution`, `ConflictStrategy`.

---

## Phase 5 – Offline Media / Asset Caching

**PR #49**

Caches images and files for offline access:

- **Media Cache Service** (`src/services/media-cache-service.ts`):
  - LRU eviction with configurable max size (default 200 MB).
  - Deterministic filename hashing for cache keys.
  - ETag-based invalidation.
  - `getCachedUri()`, `prefetchAssets()`, `evictLRU()`, `getCacheStats()`.
- **Media Upload Queue** (`src/services/media-upload-queue.ts`) – queues media uploads when offline; retries on reconnection.
- **CachedImage component** (`src/components/ui/cached-image.tsx`) – drop-in replacement for `<Image>` that uses the cache.
- **useOfflineMedia hook** (`src/hooks/use-offline-media.ts`).

---

## Phase 6 – Offline-First UI/UX Indicators

**PR #50**

Visual feedback for connectivity and sync state:

- **Offline Banner** (`src/components/ui/offline-banner.tsx`) – persistent banner when device is offline.
- **Stale Data Banner** (`src/components/ui/stale-data-banner.tsx`) – warns when cached data is old.
- **Sync Status Badge** (`src/components/ui/sync-status-badge.tsx`) – shows sync progress.
- **Sync Item Indicator** (`src/components/ui/sync-item-indicator.tsx`) – per-record sync status icon.
- **useNetworkStatus hook** (`src/hooks/use-network-status.ts`) – reactive `isConnected`, `isInternetReachable`, `justReconnected`.
- **Sync Store** (`src/stores/sync-store.ts`) – `selectPendingCount`, `selectFailedCount` selectors.

---

## Phase 7 – Background Sync & Periodic Refresh

**PR #51/#52**

Automatic syncing in the background:

- **Background Sync Service** (`src/services/background-sync.ts`):
  - Registers an `expo-task-manager` background fetch task.
  - `runSyncPass()` – replays pending mutations, retries media uploads, prefetches data.
  - `checkSyncConditions()` – checks network, battery, cellular restrictions.
- **useBackgroundSync hook** (`src/hooks/use-background-sync.ts`) – registers the task, triggers sync on app foreground, exposes `triggerSync()`.
- **Offline Config** (`src/constants/offline-config.ts`) – central configuration: intervals, retry limits, battery thresholds.

---

## Phase 8 – Testing, Monitoring & Hardening

**Current phase**

### 8.1 Testing

New test files in `__tests__/`:

| Test File | What It Covers |
|---|---|
| `sync-queue-replay.test.ts` | Queue seeding, status transitions, failure tracking, reset, edge cases |
| `circuit-breaker.test.ts` | Closed → open → half-open → closed transitions, cooldown, manual reset |
| `offline-logger.test.ts` | Ring buffer, listeners, analytics counters, summary generation |
| `sync-queue-hardening.test.ts` | Corrupt entry validation, stale pruning, mid-sync recovery, network debounce, storage quota |

Test helpers in `src/utils/offline-test-helpers.ts`:
- `simulateNetworkStatus()` / `withOfflineSimulation()` – mock network state.
- `seedSyncQueue()` / `getSyncQueueSnapshot()` / `resetSyncQueue()` – queue manipulation.
- `delay()` / `waitFor()` – async timing utilities.

### 8.2 Monitoring & Analytics

**Offline Logger** (`src/services/offline-logger.ts`):
- Structured event logging with 40+ event types.
- In-memory ring buffer (200 entries max).
- Listener API for real-time event subscriptions.
- **Sync Analytics** – aggregate counters: sync attempts, successes, failures, items synced, conflicts, corrupt entries, storage warnings.
- `getSyncAnalytics()` / `resetSyncAnalytics()` for programmatic access.

**Debug Screen** (`app/offline-debug.tsx`):
- Dev-only screen showing: network status, sync queue, analytics counters, circuit breaker states, background task history, and event log.
- Pull-to-refresh, auto-refresh every 3 seconds.
- "Trigger Sync Now" and "Clear Log" actions.

### 8.3 Edge-Case Hardening

**Circuit Breaker** (`src/services/circuit-breaker.ts`):
- Prevents cascading failures with closed → open → half-open state machine.
- Three shared instances: `syncCircuitBreaker`, `mediaUploadCircuitBreaker`, `backgroundSyncCircuitBreaker`.
- Configurable failure threshold and cooldown period.

**Sync Queue Hardening** (`src/services/sync-queue-hardening.ts`):

| Edge Case | Solution |
|---|---|
| **Corrupt queue entries** | `validateSyncItem()` checks required fields, types, date validity. `purgeCorruptQueueEntries()` removes and logs invalid entries. |
| **Stale entries** | `pruneStaleQueueEntries()` removes entries older than 7 days or exceeding max retries. |
| **App killed mid-sync** | `markSyncInProgress()` / `clearSyncInProgress()` persist a flag to AsyncStorage. `recoverFromInterruptedSync()` resets stuck "syncing" items to "pending" on next launch. |
| **Storage quota exceeded** | `estimateStorageUsage()` approximates AsyncStorage usage. `checkStorageQuota()` warns when usage exceeds 5 MB. |
| **Rapid online/offline toggling** | `handleNetworkChange()` debounces network state changes (default 2 s) to prevent multiple sync triggers. |

**Offline Error Boundary** (`src/components/offline-error-boundary.tsx`):
- React error boundary that catches rendering errors in offline-related components.
- Logs errors via the offline logger.
- Shows a graceful fallback with "Try Again" button.

**Startup Hardening** – `runStartupHardening()` runs all checks on app launch:
1. Recover from interrupted sync
2. Purge corrupt queue entries
3. Prune stale entries
4. Check storage quota

---

## How to Test

### Unit Tests

```bash
# Run all offline-related tests
npm test -- --testPathPattern="(sync-queue|circuit-breaker|offline-logger|hardening)"

# Run all tests
npm test
```

### Manual Testing

1. **Simulate offline**: Enable airplane mode on the device/simulator.
2. **Create records**: Add irrigation logs, spray records, etc. while offline.
3. **Check sync queue**: Open the debug screen (dev only) at `/offline-debug`.
4. **Go online**: Disable airplane mode and observe sync progress.
5. **Verify conflicts**: Edit the same record on two devices, then sync.

### Debug Screen

Navigate to `/offline-debug` in development mode to see:
- Real-time network status
- Sync queue contents and status
- Aggregate sync analytics
- Circuit breaker states
- Background task execution history
- Structured event log

---

## Known Limitations

1. **PowerSync dependency**: Offline reads require PowerSync to be configured with valid Supabase credentials. Without it, only TanStack Query's cache provides offline reads.

2. **Background sync on iOS**: iOS limits background fetch frequency. The 15-minute interval is a minimum; the OS may delay execution based on app usage patterns.

3. **Storage limits**: AsyncStorage has platform-specific limits (~6 MB on Android by default). The media cache uses `expo-file-system` which has more generous limits, but the 200 MB default should be tuned per device.

4. **Conflict resolution base snapshot**: The current implementation uses the local record as an approximation of the base snapshot. A production-grade system would store the original base when the edit is made.

5. **Media upload retry**: The media upload queue retry logic (Phase 5) is stubbed in the background sync service. Full integration requires wiring the `media-upload-queue.ts` service.

6. **No server-side conflict detection**: Conflicts are detected client-side by comparing `updated_at` timestamps. Server-side triggers or version vectors would provide stronger guarantees.

7. **Web platform**: Background sync and battery checks are no-ops on web. The offline experience is limited to TanStack Query caching.
