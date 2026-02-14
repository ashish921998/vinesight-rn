/**
 * StorageManager
 * Manages offline cache with TTL-based expiration, LRU eviction,
 * and 100MB storage budget tracking.
 *
 * Uses AsyncStorage (already in the project) as the persistence layer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CacheEntry, StorageBudget } from './types';

// ============================================================
// MARK: - Constants
// ============================================================

const STORAGE_PREFIX = '@vinesight_cache:';
const BUDGET_KEY = '@vinesight_cache:__budget__';
const INDEX_KEY = '@vinesight_cache:__index__';

/** Default storage budget: 100MB */
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

/** Default TTL: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================
// MARK: - Helpers
// ============================================================

function estimateSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    // UTF-16 encoding: ~2 bytes per character
    return json.length * 2;
  } catch {
    return 0;
  }
}

function prefixKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isExpired(entry: CacheEntry): boolean {
  if (entry.ttlMs === null) return false;
  const storedAt = new Date(entry.storedAt).getTime();
  return Date.now() - storedAt > entry.ttlMs;
}

// ============================================================
// MARK: - StorageManager Class
// ============================================================

class StorageManagerImpl {
  private budget: StorageBudget = {
    maxBytes: DEFAULT_MAX_BYTES,
    currentBytes: 0,
  };

  private index: Map<string, { sizeBytes: number; lastAccessedAt: string }> = new Map();
  private initialized = false;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [budgetRaw, indexRaw] = await AsyncStorage.multiGet([BUDGET_KEY, INDEX_KEY]);

      if (budgetRaw[1]) {
        const parsed = JSON.parse(budgetRaw[1]) as StorageBudget;
        this.budget = { ...this.budget, currentBytes: parsed.currentBytes };
      }

      if (indexRaw[1]) {
        const parsed = JSON.parse(indexRaw[1]) as Array<
          [string, { sizeBytes: number; lastAccessedAt: string }]
        >;
        this.index = new Map(parsed);
      }

      this.initialized = true;
    } catch (error) {
      if (__DEV__) {
        console.error('[StorageManager] Initialization error:', error);
      }
      this.initialized = true;
    }
  }

  // ----------------------------------------------------------
  // Core Operations
  // ----------------------------------------------------------

  /**
   * Store a value in the cache with optional TTL.
   */
  async set<T>(key: string, data: T, ttlMs: number | null = DEFAULT_TTL_MS): Promise<void> {
    await this.initialize();

    const now = new Date().toISOString();
    const sizeBytes = estimateSize(data);

    // Evict if needed to make room
    await this.ensureSpace(sizeBytes);

    const entry: CacheEntry<T> = {
      data,
      storedAt: now,
      ttlMs,
      sizeBytes,
      lastAccessedAt: now,
      key,
    };

    const storageKey = prefixKey(key);
    const serialized = JSON.stringify(entry);

    // Remove old entry size if updating
    const existing = this.index.get(key);
    if (existing) {
      this.budget.currentBytes -= existing.sizeBytes;
    }

    await AsyncStorage.setItem(storageKey, serialized);

    // Update index and budget
    this.index.set(key, { sizeBytes, lastAccessedAt: now });
    this.budget.currentBytes += sizeBytes;

    await this.persistMetadata();
  }

  /**
   * Retrieve a value from the cache. Returns null if not found or expired.
   */
  async get<T>(key: string): Promise<T | null> {
    await this.initialize();

    const storageKey = prefixKey(key);

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;

      // Check expiration
      if (isExpired(entry)) {
        await this.remove(key);
        return null;
      }

      // Update last accessed time (LRU tracking)
      const now = new Date().toISOString();
      entry.lastAccessedAt = now;
      this.index.set(key, { sizeBytes: entry.sizeBytes, lastAccessedAt: now });

      // Persist updated access time (fire-and-forget)
      AsyncStorage.setItem(storageKey, JSON.stringify(entry)).catch(() => {});
      this.persistMetadata().catch(() => {});

      return entry.data;
    } catch (error) {
      if (__DEV__) {
        console.error(`[StorageManager] Error reading key "${key}":`, error);
      }
      return null;
    }
  }

  /**
   * Get a cache entry with metadata (storedAt, etc.)
   */
  async getEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    await this.initialize();

    const storageKey = prefixKey(key);

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;

      if (isExpired(entry)) {
        await this.remove(key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Remove a specific key from the cache.
   */
  async remove(key: string): Promise<void> {
    await this.initialize();

    const storageKey = prefixKey(key);
    const existing = this.index.get(key);

    await AsyncStorage.removeItem(storageKey);

    if (existing) {
      this.budget.currentBytes = Math.max(0, this.budget.currentBytes - existing.sizeBytes);
      this.index.delete(key);
    }

    await this.persistMetadata();
  }

  /**
   * Check if a key exists and is not expired.
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Clear all cached data.
   */
  async clear(): Promise<void> {
    await this.initialize();

    const keys = Array.from(this.index.keys()).map(prefixKey);
    keys.push(BUDGET_KEY, INDEX_KEY);

    await AsyncStorage.multiRemove(keys);

    this.index.clear();
    this.budget.currentBytes = 0;
    this.initialized = false;
  }

  // ----------------------------------------------------------
  // Budget & Eviction
  // ----------------------------------------------------------

  /**
   * Get current storage budget status.
   */
  getBudget(): StorageBudget {
    return { ...this.budget };
  }

  /**
   * Ensure there is enough space for a new entry.
   * Uses LRU eviction to free space.
   */
  private async ensureSpace(requiredBytes: number): Promise<void> {
    if (this.budget.currentBytes + requiredBytes <= this.budget.maxBytes) {
      return;
    }

    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.index.entries()).sort(
      ([, a], [, b]) =>
        new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime(),
    );

    let freedBytes = 0;
    const keysToRemove: string[] = [];

    for (const [key, meta] of entries) {
      if (this.budget.currentBytes - freedBytes + requiredBytes <= this.budget.maxBytes) {
        break;
      }
      keysToRemove.push(key);
      freedBytes += meta.sizeBytes;
    }

    if (keysToRemove.length > 0) {
      const storageKeys = keysToRemove.map(prefixKey);
      await AsyncStorage.multiRemove(storageKeys);

      for (const key of keysToRemove) {
        this.index.delete(key);
      }

      this.budget.currentBytes = Math.max(0, this.budget.currentBytes - freedBytes);

      if (__DEV__) {
        console.log(
          `[StorageManager] Evicted ${keysToRemove.length} entries, freed ${(freedBytes / 1024).toFixed(1)}KB`,
        );
      }
    }
  }

  /**
   * Remove all expired entries.
   */
  async purgeExpired(): Promise<number> {
    await this.initialize();

    const keys = Array.from(this.index.keys());
    let purgedCount = 0;

    for (const key of keys) {
      const storageKey = prefixKey(key);
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) continue;

        const entry = JSON.parse(raw) as CacheEntry;
        if (isExpired(entry)) {
          await this.remove(key);
          purgedCount++;
        }
      } catch {
        // Skip corrupted entries
      }
    }

    if (__DEV__ && purgedCount > 0) {
      console.log(`[StorageManager] Purged ${purgedCount} expired entries`);
    }

    return purgedCount;
  }

  // ----------------------------------------------------------
  // Persistence Helpers
  // ----------------------------------------------------------

  private async persistMetadata(): Promise<void> {
    try {
      const indexArray = Array.from(this.index.entries());
      await AsyncStorage.multiSet([
        [BUDGET_KEY, JSON.stringify(this.budget)],
        [INDEX_KEY, JSON.stringify(indexArray)],
      ]);
    } catch (error) {
      if (__DEV__) {
        console.error('[StorageManager] Error persisting metadata:', error);
      }
    }
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

export const StorageManager = new StorageManagerImpl();
export default StorageManager;
