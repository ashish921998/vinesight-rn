/**
 * Background Sync Store – Zustand store for tracking background sync state.
 *
 * Tracks registration status, last sync times, sync activity log,
 * and scheduling metadata for the background sync system.
 *
 * Phase 7: Background Sync & Periodic Refresh
 */

import { create } from 'zustand';

// ============================================================
// MARK: - Types
// ============================================================

export interface SyncLogEntry {
  /** ISO timestamp. */
  timestamp: string;
  /** Log level. */
  level: 'info' | 'warn' | 'error';
  /** Human-readable message. */
  message: string;
}

export interface BackgroundSyncState {
  /** Whether the background fetch task is registered with the OS. */
  isRegistered: boolean;
  /** Whether a background sync is currently in progress. */
  isSyncing: boolean;
  /** ISO timestamp of the last successful background sync. */
  lastSyncAt: string | null;
  /** ISO timestamp of the last data refresh. */
  lastRefreshAt: string | null;
  /** Approximate next scheduled sync (informational only; OS controls actual timing). */
  nextScheduledAt: string | null;
  /** Number of pending mutations in the sync queue. */
  pendingMutationCount: number;
  /** Recent sync activity log (capped at 50 entries). */
  syncLog: SyncLogEntry[];
  /** Last error encountered during sync. */
  lastError: string | null;
}

export interface BackgroundSyncActions {
  setRegistered: (registered: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncAt: (timestamp: string) => void;
  setLastRefreshAt: (timestamp: string) => void;
  setNextScheduledAt: (timestamp: string | null) => void;
  setPendingMutationCount: (count: number) => void;
  setLastError: (error: string | null) => void;
  addLogEntry: (level: SyncLogEntry['level'], message: string) => void;
  clearLog: () => void;
  reset: () => void;
}

// ============================================================
// MARK: - Initial State
// ============================================================

const MAX_LOG_ENTRIES = 50;

const initialState: BackgroundSyncState = {
  isRegistered: false,
  isSyncing: false,
  lastSyncAt: null,
  lastRefreshAt: null,
  nextScheduledAt: null,
  pendingMutationCount: 0,
  syncLog: [],
  lastError: null,
};

// ============================================================
// MARK: - Store
// ============================================================

export const useBackgroundSyncStore = create<BackgroundSyncState & BackgroundSyncActions>(
  (set) => ({
    ...initialState,

    setRegistered: (registered) => set({ isRegistered: registered }),

    setSyncing: (syncing) => set({ isSyncing: syncing }),

    setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

    setLastRefreshAt: (timestamp) => set({ lastRefreshAt: timestamp }),

    setNextScheduledAt: (timestamp) => set({ nextScheduledAt: timestamp }),

    setPendingMutationCount: (count) => set({ pendingMutationCount: count }),

    setLastError: (error) => set({ lastError: error }),

    addLogEntry: (level, message) =>
      set((state) => {
        const entry: SyncLogEntry = {
          timestamp: new Date().toISOString(),
          level,
          message,
        };
        const log = [entry, ...state.syncLog].slice(0, MAX_LOG_ENTRIES);
        return { syncLog: log };
      }),

    clearLog: () => set({ syncLog: [] }),

    reset: () => set(initialState),
  }),
);
