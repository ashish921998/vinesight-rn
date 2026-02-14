/**
 * Conflict Resolution Store
 *
 * Zustand store that manages the conflict queue — unresolved conflicts
 * are persisted to AsyncStorage so they survive app restarts.
 *
 * Phase 4: Conflict Resolution
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ConflictStoreState,
  ConflictStoreActions,
  SyncConflict,
  ConflictResolution,
  ConflictStrategy,
} from '@/types/conflict';

// AsyncStorage key for persisting the conflict queue
const CONFLICT_STORAGE_KEY = '@vinesight/conflict-queue';
const STRATEGY_STORAGE_KEY = '@vinesight/conflict-strategy';

/**
 * Persist the conflict list to AsyncStorage.
 * Only persists pending and failed conflicts (resolved ones are ephemeral).
 */
async function persistConflicts(conflicts: SyncConflict[]): Promise<void> {
  try {
    const toStore = conflicts.filter((c) => c.status !== 'resolved');
    await AsyncStorage.setItem(CONFLICT_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    if (__DEV__) {
      console.error('[ConflictStore] Failed to persist conflicts:', error);
    }
  }
}

/**
 * Load persisted conflicts from AsyncStorage.
 */
async function loadPersistedConflicts(): Promise<SyncConflict[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncConflict[];
  } catch (error) {
    if (__DEV__) {
      console.error('[ConflictStore] Failed to load conflicts:', error);
    }
    return [];
  }
}

/**
 * Load the persisted default strategy from AsyncStorage.
 */
async function loadPersistedStrategy(): Promise<ConflictStrategy> {
  try {
    const raw = await AsyncStorage.getItem(STRATEGY_STORAGE_KEY);
    if (raw === 'merge' || raw === 'prompt-user' || raw === 'last-write-wins') {
      return raw;
    }
    return 'last-write-wins';
  } catch {
    return 'last-write-wins';
  }
}

export const useConflictStore = create<ConflictStoreState & ConflictStoreActions>((set, get) => ({
  // ── State ──────────────────────────────────────────────────
  conflicts: [],
  activeConflict: null,
  isModalVisible: false,
  defaultStrategy: 'last-write-wins',
  isLoading: false,

  // ── Actions ────────────────────────────────────────────────

  /**
   * Load persisted conflicts and strategy from AsyncStorage.
   * Called once during app initialization.
   */
  loadConflicts: async () => {
    set({ isLoading: true });
    try {
      const [conflicts, strategy] = await Promise.all([
        loadPersistedConflicts(),
        loadPersistedStrategy(),
      ]);
      set({ conflicts, defaultStrategy: strategy, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  /**
   * Add a new conflict to the queue and persist it.
   */
  addConflict: async (conflict: SyncConflict) => {
    const { conflicts } = get();
    // Avoid duplicates — replace if same table + recordId already exists
    const filtered = conflicts.filter(
      (c) => !(c.table === conflict.table && c.recordId === conflict.recordId),
    );
    const updated = [...filtered, conflict];
    set({ conflicts: updated });
    await persistConflicts(updated);
  },

  /**
   * Resolve a conflict: update its status and persist.
   */
  resolveConflict: async (resolution: ConflictResolution) => {
    const { conflicts, activeConflict } = get();
    const now = new Date().toISOString();
    const updated = conflicts.map((c) =>
      c.id === resolution.conflictId
        ? {
            ...c,
            status: 'resolved' as const,
            resolvedAt: now,
            resolvedBy: resolution.strategy,
          }
        : c,
    );
    set({
      conflicts: updated,
      // Close modal if the resolved conflict was the active one
      activeConflict:
        activeConflict?.id === resolution.conflictId ? null : activeConflict,
      isModalVisible:
        activeConflict?.id === resolution.conflictId ? false : get().isModalVisible,
    });
    await persistConflicts(updated);
  },

  /**
   * Mark a conflict as failed (e.g., resolution attempt errored).
   */
  markConflictFailed: async (conflictId: string) => {
    const { conflicts } = get();
    const updated = conflicts.map((c) =>
      c.id === conflictId
        ? { ...c, status: 'failed' as const, retryCount: c.retryCount + 1 }
        : c,
    );
    set({ conflicts: updated });
    await persistConflicts(updated);
  },

  /**
   * Remove a single conflict from the queue.
   */
  removeConflict: async (conflictId: string) => {
    const { conflicts } = get();
    const updated = conflicts.filter((c) => c.id !== conflictId);
    set({ conflicts: updated });
    await persistConflicts(updated);
  },

  /**
   * Clear all resolved conflicts from the queue.
   */
  clearResolvedConflicts: async () => {
    const { conflicts } = get();
    const updated = conflicts.filter((c) => c.status !== 'resolved');
    set({ conflicts: updated });
    await persistConflicts(updated);
  },

  /**
   * Show the conflict resolution modal for a specific conflict.
   */
  showConflictModal: (conflict: SyncConflict) => {
    set({ activeConflict: conflict, isModalVisible: true });
  },

  /**
   * Hide the conflict resolution modal.
   */
  hideConflictModal: () => {
    set({ activeConflict: null, isModalVisible: false });
  },

  /**
   * Update the default conflict resolution strategy and persist it.
   */
  setDefaultStrategy: (strategy: ConflictStrategy) => {
    set({ defaultStrategy: strategy });
    AsyncStorage.setItem(STRATEGY_STORAGE_KEY, strategy).catch((error) => {
      if (__DEV__) {
        console.error('[ConflictStore] Failed to persist strategy:', error);
      }
    });
  },

  /**
   * Get all pending (unresolved) conflicts.
   */
  getPendingConflicts: () => {
    return get().conflicts.filter((c) => c.status === 'pending');
  },
}));
