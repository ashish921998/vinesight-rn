/**
 * SyncEngine
 * Manages background sync when connectivity is restored.
 * Implements last-write-wins conflict resolution and per-entity sync tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { networkMonitor } from './NetworkMonitor';
import { offlineQueue } from './OfflineQueue';
import { StorageManager } from './StorageManager';
import type { SyncStatus, SyncConfig } from './types';

// ============================================================
// MARK: - Constants
// ============================================================

const SYNC_STATUS_KEY = '@vinesight_sync_status';
const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// MARK: - Event Types
// ============================================================

type SyncListener = (statuses: Map<string, SyncStatus>) => void;

// ============================================================
// MARK: - SyncEngine Class
// ============================================================

class SyncEngineImpl {
  private statuses: Map<string, SyncStatus> = new Map();
  private listeners: Set<SyncListener> = new Set();
  private config: SyncConfig = {
    conflictStrategy: 'last-write-wins',
    autoSync: true,
    syncIntervalMs: DEFAULT_SYNC_INTERVAL_MS,
  };
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private initialized = false;
  private syncing = false;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  /**
   * Initialize the sync engine. Loads persisted sync statuses
   * and starts listening for connectivity changes.
   */
  async initialize(config?: Partial<SyncConfig>): Promise<void> {
    if (this.initialized) return;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Load persisted sync statuses
    try {
      const raw = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<[string, SyncStatus]>;
        this.statuses = new Map(parsed);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncEngine] Failed to load sync statuses:', error);
      }
    }

    // Listen for connectivity restoration
    if (this.config.autoSync) {
      this.networkUnsubscribe = networkMonitor.subscribe((state) => {
        if (state.isConnected && !this.syncing) {
          this.sync().catch(() => {});
        }
      });

      // Set up periodic sync
      this.syncTimer = setInterval(() => {
        if (networkMonitor.isOnline() && !this.syncing) {
          this.sync().catch(() => {});
        }
      }, this.config.syncIntervalMs);
    }

    this.initialized = true;
  }

  /**
   * Stop the sync engine and clean up.
   */
  stop(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }

  // ----------------------------------------------------------
  // Sync Operations
  // ----------------------------------------------------------

  /**
   * Trigger a full sync cycle.
   * Processes the offline queue and updates sync statuses.
   */
  async sync(): Promise<void> {
    if (this.syncing) return;
    if (!networkMonitor.isOnline()) return;

    this.syncing = true;
    this.notifyListeners();

    try {
      // Mark all pending entities as syncing
      for (const [key, status] of this.statuses) {
        if (status.state === 'pending') {
          this.statuses.set(key, { ...status, state: 'syncing' });
        }
      }
      this.notifyListeners();

      // Process the offline queue
      await offlineQueue.processQueue();

      // Update sync statuses based on queue results
      const queue = offlineQueue.getQueue();
      const failedIds = new Set(
        queue.filter((m) => m.status === 'failed').map((m) => this.entityKey(m.entityType, m.entityId)),
      );

      for (const [key, status] of this.statuses) {
        if (status.state === 'syncing') {
          if (failedIds.has(key)) {
            this.statuses.set(key, { ...status, state: 'error', errorMessage: 'Sync failed' });
          } else {
            this.statuses.set(key, {
              ...status,
              state: 'synced',
              lastSyncedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Purge expired cache entries during sync
      await StorageManager.purgeExpired();

      if (__DEV__) {
        console.log('[SyncEngine] Sync cycle completed');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncEngine] Sync error:', error);
      }
    } finally {
      this.syncing = false;
      await this.persistStatuses();
      this.notifyListeners();
    }
  }

  // ----------------------------------------------------------
  // Status Tracking
  // ----------------------------------------------------------

  /**
   * Mark an entity as having pending local changes.
   */
  markPending(entityType: string, entityId: string | number): void {
    const key = this.entityKey(entityType, entityId);
    const existing = this.statuses.get(key);

    this.statuses.set(key, {
      entityType,
      entityId,
      state: 'pending',
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      lastModifiedAt: new Date().toISOString(),
    });

    this.persistStatuses().catch(() => {});
    this.notifyListeners();
  }

  /**
   * Mark an entity as synced.
   */
  markSynced(entityType: string, entityId: string | number): void {
    const key = this.entityKey(entityType, entityId);

    this.statuses.set(key, {
      entityType,
      entityId,
      state: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    });

    this.persistStatuses().catch(() => {});
    this.notifyListeners();
  }

  /**
   * Get the sync status for a specific entity.
   */
  getStatus(entityType: string, entityId: string | number): SyncStatus | undefined {
    return this.statuses.get(this.entityKey(entityType, entityId));
  }

  /**
   * Get all sync statuses.
   */
  getAllStatuses(): SyncStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Check if there are any pending syncs.
   */
  hasPendingSyncs(): boolean {
    for (const status of this.statuses.values()) {
      if (status.state === 'pending' || status.state === 'syncing') {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the engine is currently syncing.
   */
  isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Clear sync status for a specific entity.
   */
  clearStatus(entityType: string, entityId: string | number): void {
    this.statuses.delete(this.entityKey(entityType, entityId));
    this.persistStatuses().catch(() => {});
    this.notifyListeners();
  }

  /**
   * Clear all sync statuses.
   */
  async clearAll(): Promise<void> {
    this.statuses.clear();
    await this.persistStatuses();
    this.notifyListeners();
  }

  // ----------------------------------------------------------
  // Conflict Resolution
  // ----------------------------------------------------------

  /**
   * Resolve a conflict between local and server data.
   * Uses the configured conflict strategy (default: last-write-wins).
   */
  resolveConflict<T extends Record<string, unknown>>(
    localData: T,
    serverData: T,
    localModifiedAt: string,
    serverModifiedAt: string,
  ): T {
    switch (this.config.conflictStrategy) {
      case 'last-write-wins': {
        const localTime = new Date(localModifiedAt).getTime();
        const serverTime = new Date(serverModifiedAt).getTime();
        return localTime >= serverTime ? localData : serverData;
      }
      case 'server-wins':
        return serverData;
      case 'client-wins':
        return localData;
      default:
        return serverData;
    }
  }

  // ----------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------

  /**
   * Subscribe to sync status changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.statuses));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = new Map(this.statuses);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private entityKey(entityType?: string, entityId?: string | number): string {
    return `${entityType ?? 'unknown'}:${entityId ?? 'unknown'}`;
  }

  private async persistStatuses(): Promise<void> {
    try {
      const entries = Array.from(this.statuses.entries());
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(entries));
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncEngine] Failed to persist sync statuses:', error);
      }
    }
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

export const syncEngine = new SyncEngineImpl();
export default syncEngine;
