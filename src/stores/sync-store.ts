/**
 * Sync Store – Zustand store for tracking offline sync queue state.
 *
 * Other parts of the app (sync-queue, mutation hooks, etc.) should call
 * the actions here to keep the UI indicators in sync.
 */

import { create } from 'zustand';

export type SyncItemStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncItem {
  id: string;
  status: SyncItemStatus;
  /** ISO timestamp of when the item was queued. */
  queuedAt: string;
  /** Human-readable label, e.g. "Irrigation record". */
  label?: string;
  /** Number of retry attempts so far. */
  retries: number;
  /** Error message if status is 'failed'. */
  error?: string;
}

export type SyncStoreState = {
  /** Map of item-id → SyncItem. */
  items: Record<string, SyncItem>;
  /** Whether a bulk sync pass is currently running. */
  isSyncing: boolean;
  /** Timestamp of the last successful full sync (ISO string). */
  lastSyncedAt: string | null;
};

export type SyncStoreActions = {
  /** Enqueue or update an item in the sync queue. */
  upsertItem: (id: string, patch: Partial<Omit<SyncItem, 'id'>>) => void;
  /** Remove an item (e.g. after successful sync). */
  removeItem: (id: string) => void;
  /** Mark all pending items as syncing. */
  markAllSyncing: () => void;
  /** Mark a specific item as failed. */
  markFailed: (id: string, error?: string) => void;
  /** Mark a specific item as synced and remove it. */
  markSynced: (id: string) => void;
  /** Set the global syncing flag. */
  setSyncing: (syncing: boolean) => void;
  /** Record a successful full sync. */
  recordSync: () => void;
  /** Reset the store (e.g. on logout). */
  reset: () => void;
};

const initialState: SyncStoreState = {
  items: {},
  isSyncing: false,
  lastSyncedAt: null,
};

export const useSyncStore = create<SyncStoreState & SyncStoreActions>((set) => ({
  ...initialState,

  upsertItem: (id, patch) =>
    set((state) => {
      const existing = state.items[id];
      return {
        items: {
          ...state.items,
          [id]: {
            id,
            status: 'pending',
            queuedAt: new Date().toISOString(),
            retries: 0,
            ...existing,
            ...patch,
          },
        },
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.items;
      return { items: rest };
    }),

  markAllSyncing: () =>
    set((state) => {
      const updated: Record<string, SyncItem> = {};
      for (const [id, item] of Object.entries(state.items)) {
        updated[id] = { ...item, status: item.status === 'pending' ? 'syncing' : item.status };
      }
      return { items: updated, isSyncing: true };
    }),

  markFailed: (id, error) =>
    set((state) => {
      const item = state.items[id];
      if (!item) return state;
      return {
        items: {
          ...state.items,
          [id]: { ...item, status: 'failed', error, retries: item.retries + 1 },
        },
      };
    }),

  markSynced: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.items;
      return { items: rest };
    }),

  setSyncing: (syncing) => set({ isSyncing: syncing }),

  recordSync: () => set({ isSyncing: false, lastSyncedAt: new Date().toISOString() }),

  reset: () => set(initialState),
}));

// ── Derived selectors ──────────────────────────────────────────────

export const selectPendingCount = (state: SyncStoreState) =>
  Object.values(state.items).filter((i) => i.status === 'pending' || i.status === 'syncing').length;

export const selectFailedCount = (state: SyncStoreState) =>
  Object.values(state.items).filter((i) => i.status === 'failed').length;

export const selectItemStatus = (id: string) => (state: SyncStoreState) =>
  state.items[id]?.status ?? null;
