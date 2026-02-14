/**
 * StorageManager - Offline Storage Management & Data Pruning
 * Phase 8.2
 *
 * Manages a budgeted offline cache using AsyncStorage with:
 * - 100 MB storage budget
 * - TTL-based expiration for cached entries
 * - LRU eviction when the budget is exceeded
 * - Storage monitoring and statistics
 *
 * All cache entries are stored with a common key prefix so they
 * can be enumerated without interfering with other AsyncStorage data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CacheEntryMeta, CacheSetOptions, StorageStats } from './types';

// ============================================================
// MARK: - Constants
// ============================================================

/** Key prefix for all offline cache entries */
const CACHE_PREFIX = '@vinesight_cache:';

/** Key used to persist the metadata index */
const META_INDEX_KEY = '@vinesight_cache_meta_index';

/** Default storage budget: 100 MB */
const DEFAULT_BUDGET_BYTES = 100 * 1024 * 1024;

/** Default TTL: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Percentage of budget to free when eviction is triggered (20%) */
const EVICTION_FREE_PERCENT = 0.2;

// ============================================================
// MARK: - Internal Helpers
// ============================================================

/**
 * Compute the byte length of a UTF-16 string (JS strings are UTF-16).
 * This is an approximation; AsyncStorage may add its own overhead.
 */
function byteLength(str: string): number {
  // Each JS char is at most 2 bytes in UTF-16; for a rough budget
  // estimate we use the Blob-style byte count.
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
  }
  return bytes;
}

// ============================================================
// MARK: - StorageManager
// ============================================================

export class StorageManager {
  /** Expose constants for external use / testing */
  static readonly DEFAULT_TTL_MS = DEFAULT_TTL_MS;
  static readonly DEFAULT_BUDGET_BYTES = DEFAULT_BUDGET_BYTES;

  // In-memory mirror of the metadata index for fast lookups.
  // Lazily loaded from AsyncStorage on first access.
  private static metaIndex: Map<string, CacheEntryMeta> | null = null;
  private static budgetBytes: number = DEFAULT_BUDGET_BYTES;

  // ----------------------------------------------------------
  // Metadata index persistence
  // ----------------------------------------------------------

  /** Load the metadata index from AsyncStorage into memory */
  private static async loadIndex(): Promise<Map<string, CacheEntryMeta>> {
    if (StorageManager.metaIndex) return StorageManager.metaIndex;

    try {
      const raw = await AsyncStorage.getItem(META_INDEX_KEY);
      if (raw) {
        const entries: CacheEntryMeta[] = JSON.parse(raw);
        StorageManager.metaIndex = new Map(entries.map((e) => [e.key, e]));
      } else {
        StorageManager.metaIndex = new Map();
      }
    } catch {
      // If the index is corrupted, start fresh
      if (__DEV__) {
        console.warn('[StorageManager] Meta index corrupted – resetting');
      }
      StorageManager.metaIndex = new Map();
    }

    return StorageManager.metaIndex;
  }

  /** Persist the in-memory metadata index to AsyncStorage */
  private static async saveIndex(): Promise<void> {
    const index = await StorageManager.loadIndex();
    const entries = Array.from(index.values());
    await AsyncStorage.setItem(META_INDEX_KEY, JSON.stringify(entries));
  }

  // ----------------------------------------------------------
  // Public API – CRUD
  // ----------------------------------------------------------

  /**
   * Store a value in the offline cache.
   *
   * If the resulting total size exceeds the budget, LRU eviction
   * is triggered automatically before the write completes.
   */
  static async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const index = await StorageManager.loadIndex();
    const serialized = JSON.stringify(value);
    const size = byteLength(serialized);
    const now = new Date().toISOString();
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

    const meta: CacheEntryMeta = {
      key,
      sizeBytes: size,
      createdAt: now,
      lastAccessedAt: now,
      ttlMs,
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
    };

    // If the single entry exceeds the entire budget, reject it
    if (size > StorageManager.budgetBytes) {
      throw new Error(
        `[StorageManager] Entry "${key}" (${size} bytes) exceeds storage budget (${StorageManager.budgetBytes} bytes)`,
      );
    }

    // Evict if necessary to make room
    await StorageManager.ensureBudget(size, key);

    // Write value and update index
    const storageKey = CACHE_PREFIX + key;
    await AsyncStorage.setItem(storageKey, serialized);
    index.set(key, meta);
    await StorageManager.saveIndex();
  }

  /**
   * Retrieve a cached value. Returns `null` if the key does not
   * exist or has expired. Expired entries are removed lazily.
   */
  static async get<T>(key: string): Promise<T | null> {
    const index = await StorageManager.loadIndex();
    const meta = index.get(key);

    if (!meta) return null;

    // Check TTL expiration
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      await StorageManager.remove(key);
      return null;
    }

    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (raw === null) {
        // Data missing but meta exists – clean up
        index.delete(key);
        await StorageManager.saveIndex();
        return null;
      }

      // Update last-accessed timestamp for LRU tracking
      meta.lastAccessedAt = new Date().toISOString();
      index.set(key, meta);
      // Persist updated access time (fire-and-forget to avoid blocking reads)
      StorageManager.saveIndex().catch(() => {});

      return JSON.parse(raw) as T;
    } catch {
      // Corrupted data – remove entry
      if (__DEV__) {
        console.warn(`[StorageManager] Corrupted data for key "${key}" – removing`);
      }
      await StorageManager.remove(key);
      return null;
    }
  }

  /** Check whether a non-expired entry exists for the given key */
  static async has(key: string): Promise<boolean> {
    const index = await StorageManager.loadIndex();
    const meta = index.get(key);
    if (!meta) return false;

    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      await StorageManager.remove(key);
      return false;
    }

    return true;
  }

  /** Remove a single cache entry */
  static async remove(key: string): Promise<void> {
    const index = await StorageManager.loadIndex();
    index.delete(key);
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
    await StorageManager.saveIndex();
  }

  /** Remove all offline cache entries */
  static async clear(): Promise<void> {
    const index = await StorageManager.loadIndex();
    const keys = Array.from(index.keys()).map((k) => CACHE_PREFIX + k);
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
    index.clear();
    await StorageManager.saveIndex();
  }

  // ----------------------------------------------------------
  // Public API – Monitoring
  // ----------------------------------------------------------

  /** Get current storage statistics */
  static async getStats(): Promise<StorageStats> {
    const index = await StorageManager.loadIndex();
    let totalBytes = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const meta of index.values()) {
      totalBytes += meta.sizeBytes;
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() < now) {
        expiredCount++;
      }
    }

    return {
      totalBytes,
      entryCount: index.size,
      budgetBytes: StorageManager.budgetBytes,
      usagePercent: StorageManager.budgetBytes > 0 ? (totalBytes / StorageManager.budgetBytes) * 100 : 0,
      expiredCount,
    };
  }

  /** Override the default storage budget (useful for testing) */
  static setBudget(bytes: number): void {
    StorageManager.budgetBytes = bytes;
  }

  // ----------------------------------------------------------
  // Public API – Maintenance
  // ----------------------------------------------------------

  /**
   * Remove all expired entries from the cache.
   * Call this periodically (e.g., on app foreground) to reclaim space.
   */
  static async pruneExpired(): Promise<number> {
    const index = await StorageManager.loadIndex();
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, meta] of index.entries()) {
      if (meta.expiresAt && new Date(meta.expiresAt).getTime() < now) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      const storageKeys = expiredKeys.map((k) => CACHE_PREFIX + k);
      await AsyncStorage.multiRemove(storageKeys);
      for (const key of expiredKeys) {
        index.delete(key);
      }
      await StorageManager.saveIndex();
    }

    return expiredKeys.length;
  }

  // ----------------------------------------------------------
  // Internal – LRU Eviction
  // ----------------------------------------------------------

  /**
   * Ensure there is enough room in the budget for `requiredBytes`.
   *
   * Strategy:
   * 1. First, prune all expired entries.
   * 2. If still over budget, evict least-recently-used entries until
   *    we free at least `requiredBytes` + EVICTION_FREE_PERCENT of the budget.
   *
   * @param requiredBytes - bytes needed for the incoming entry
   * @param excludeKey    - key of the incoming entry (skip if already in index)
   */
  private static async ensureBudget(requiredBytes: number, excludeKey?: string): Promise<void> {
    // Step 1: prune expired entries first
    await StorageManager.pruneExpired();

    const index = await StorageManager.loadIndex();
    let currentSize = 0;
    for (const meta of index.values()) {
      currentSize += meta.sizeBytes;
    }

    // Subtract the existing size of the key we're about to overwrite
    const existing = excludeKey ? index.get(excludeKey) : undefined;
    if (existing) {
      currentSize -= existing.sizeBytes;
    }

    const targetFree = requiredBytes + StorageManager.budgetBytes * EVICTION_FREE_PERCENT;
    const available = StorageManager.budgetBytes - currentSize;

    if (available >= requiredBytes) return; // Enough space already

    // Step 2: LRU eviction – sort entries by lastAccessedAt ascending
    const entries = Array.from(index.entries())
      .filter(([key]) => key !== excludeKey)
      .sort(([, a], [, b]) => {
        return new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime();
      });

    let freed = 0;
    const keysToRemove: string[] = [];

    for (const [key, meta] of entries) {
      if (freed >= targetFree - available) break;
      keysToRemove.push(key);
      freed += meta.sizeBytes;
    }

    if (keysToRemove.length > 0) {
      const storageKeys = keysToRemove.map((k) => CACHE_PREFIX + k);
      await AsyncStorage.multiRemove(storageKeys);
      for (const key of keysToRemove) {
        index.delete(key);
      }
      await StorageManager.saveIndex();

      if (__DEV__) {
        console.log(
          `[StorageManager] LRU eviction: removed ${keysToRemove.length} entries, freed ${freed} bytes`,
        );
      }
    }
  }

  // ----------------------------------------------------------
  // Internal – Reset (for testing)
  // ----------------------------------------------------------

  /** Reset the in-memory index cache (useful in tests) */
  static _resetMemoryCache(): void {
    StorageManager.metaIndex = null;
    StorageManager.budgetBytes = DEFAULT_BUDGET_BYTES;
  }
}
