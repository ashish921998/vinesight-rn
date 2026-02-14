/**
 * Offline Test Helpers
 *
 * Utilities for simulating offline/online transitions and testing
 * sync queue replay, conflict resolution, and cache behaviour.
 *
 * Phase 8 of offline functionality.
 */

import { useSyncStore, type SyncItem } from '@/stores/sync-store';

// ── Network simulation ─────────────────────────────────────────────

let _simulatedOnline: boolean | null = null;

/**
 * Override the network status for testing.
 * Pass `null` to restore real network detection.
 */
export function simulateNetworkStatus(online: boolean | null): void {
  _simulatedOnline = online;
}

/**
 * Get the simulated network status, or `null` if not simulating.
 */
export function getSimulatedNetworkStatus(): boolean | null {
  return _simulatedOnline;
}

/**
 * Simulate going offline, run a callback, then go back online.
 */
export async function withOfflineSimulation<T>(fn: () => Promise<T>): Promise<T> {
  simulateNetworkStatus(false);
  try {
    return await fn();
  } finally {
    simulateNetworkStatus(true);
  }
}

// ── Sync queue helpers ─────────────────────────────────────────────

/**
 * Seed the sync store with mock items for testing.
 */
export function seedSyncQueue(
  items: Array<{
    id: string;
    label?: string;
    status?: SyncItem['status'];
    retries?: number;
  }>,
): void {
  const store = useSyncStore.getState();
  for (const item of items) {
    store.upsertItem(item.id, {
      label: item.label ?? `Test item ${item.id}`,
      status: item.status ?? 'pending',
      retries: item.retries ?? 0,
    });
  }
}

/**
 * Get a snapshot of the current sync queue for assertions.
 */
export function getSyncQueueSnapshot(): {
  items: Record<string, SyncItem>;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
} {
  const state = useSyncStore.getState();
  const items = state.items;
  const values = Object.values(items);
  return {
    items,
    pendingCount: values.filter((i) => i.status === 'pending' || i.status === 'syncing').length,
    failedCount: values.filter((i) => i.status === 'failed').length,
    totalCount: values.length,
  };
}

/**
 * Reset the sync store to its initial state.
 */
export function resetSyncQueue(): void {
  useSyncStore.getState().reset();
}

// ── Timing helpers ─────────────────────────────────────────────────

/**
 * Wait for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until a predicate returns true, polling at the given interval.
 * Throws after timeout.
 */
export async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 5_000, intervalMs = 100 } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await delay(intervalMs);
  }
}
