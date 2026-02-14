/**
 * Offline Storage Manager
 * AsyncStorage-based caching with TTL, LRU eviction, and 100MB storage budget.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// MARK: - Types
// ============================================================

interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Unix timestamp (ms) when the entry was created */
  createdAt: number;
  /** TTL in milliseconds */
  ttl: number;
  /** Unix timestamp (ms) of last access (for LRU) */
  lastAccessed: number;
  /** Approximate size in bytes */
  size: number;
}

interface CacheMetadata {
  key: string;
  lastAccessed: number;
  size: number;
  createdAt: number;
  ttl: number;
}

// ============================================================
// MARK: - Constants
// ============================================================

const CACHE_PREFIX = 'vs_cache:';
const METADATA_KEY = 'vs_cache_metadata';

/** Maximum storage budget in bytes (100 MB) */
const MAX_STORAGE_BYTES = 100 * 1024 * 1024;

/** Default TTL: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum TTL: 1 minute */
const MIN_TTL_MS = 60 * 1000;

// ============================================================
// MARK: - Helpers
// ============================================================

function estimateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    // Blob not available on all RN engines; fall back to string length × 2
    return JSON.stringify(value).length * 2;
  }
}

function cacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

// ============================================================
// MARK: - Metadata Management
// ============================================================

async function loadMetadata(): Promise<CacheMetadata[]> {
  try {
    const raw = await AsyncStorage.getItem(METADATA_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CacheMetadata[];
  } catch {
    return [];
  }
}

async function saveMetadata(metadata: CacheMetadata[]): Promise<void> {
  await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

function totalSize(metadata: CacheMetadata[]): number {
  return metadata.reduce((sum, m) => sum + m.size, 0);
}

// ============================================================
// MARK: - LRU Eviction
// ============================================================

async function evictIfNeeded(
  metadata: CacheMetadata[],
  incomingSize: number,
): Promise<CacheMetadata[]> {
  let current = totalSize(metadata);
  const target = MAX_STORAGE_BYTES - incomingSize;

  if (current <= target) return metadata;

  // Sort by lastAccessed ascending (oldest first) for LRU eviction
  const sorted = [...metadata].sort((a, b) => a.lastAccessed - b.lastAccessed);
  const toRemove: string[] = [];

  while (current > target && sorted.length > 0) {
    const victim = sorted.shift()!;
    toRemove.push(victim.key);
    current -= victim.size;
  }

  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove.map(cacheKey));
    if (__DEV__) {
      console.log(`[OfflineStorage] Evicted ${toRemove.length} entries to free space`);
    }
  }

  return metadata.filter((m) => !toRemove.includes(m.key));
}

// ============================================================
// MARK: - Public API
// ============================================================

/**
 * Store a value in the offline cache.
 *
 * @param key   Unique cache key (without prefix)
 * @param data  JSON-serialisable data
 * @param ttl   Time-to-live in milliseconds (default 24 h)
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_TTL_MS,
): Promise<void> {
  const effectiveTtl = Math.max(ttl, MIN_TTL_MS);
  const now = Date.now();
  const size = estimateSize(data);

  const entry: CacheEntry<T> = {
    data,
    createdAt: now,
    ttl: effectiveTtl,
    lastAccessed: now,
    size,
  };

  let metadata = await loadMetadata();

  // Evict stale entries first
  metadata = pruneExpired(metadata, now);

  // Evict LRU if budget exceeded
  metadata = await evictIfNeeded(metadata, size);

  // Remove existing entry for this key if present
  metadata = metadata.filter((m) => m.key !== key);

  // Write data
  await AsyncStorage.setItem(cacheKey(key), JSON.stringify(entry));

  // Update metadata
  metadata.push({ key, lastAccessed: now, size, createdAt: now, ttl: effectiveTtl });
  await saveMetadata(metadata);
}

/**
 * Retrieve a value from the offline cache.
 * Returns `null` if the key is missing or expired.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(key));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    const now = Date.now();

    // Check TTL
    if (now - entry.createdAt > entry.ttl) {
      // Expired – remove lazily
      void cacheRemove(key);
      return null;
    }

    // Update lastAccessed for LRU
    entry.lastAccessed = now;
    await AsyncStorage.setItem(cacheKey(key), JSON.stringify(entry));

    // Update metadata lastAccessed
    const metadata = await loadMetadata();
    const idx = metadata.findIndex((m) => m.key === key);
    if (idx !== -1) {
      metadata[idx].lastAccessed = now;
      await saveMetadata(metadata);
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Remove a single cache entry.
 */
export async function cacheRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(cacheKey(key));
  const metadata = await loadMetadata();
  await saveMetadata(metadata.filter((m) => m.key !== key));
}

/**
 * Clear all offline cache entries.
 */
export async function cacheClear(): Promise<void> {
  const metadata = await loadMetadata();
  if (metadata.length > 0) {
    await AsyncStorage.multiRemove(metadata.map((m) => cacheKey(m.key)));
  }
  await AsyncStorage.removeItem(METADATA_KEY);
}

/**
 * Get current cache statistics.
 */
export async function cacheStats(): Promise<{
  entryCount: number;
  totalBytes: number;
  budgetBytes: number;
  usagePercent: number;
}> {
  const metadata = await loadMetadata();
  const total = totalSize(metadata);
  return {
    entryCount: metadata.length,
    totalBytes: total,
    budgetBytes: MAX_STORAGE_BYTES,
    usagePercent: Math.round((total / MAX_STORAGE_BYTES) * 100),
  };
}

// ============================================================
// MARK: - Cache-First Fetcher
// ============================================================

/**
 * Cache-first data fetching strategy.
 * Returns cached data if available and fresh; otherwise fetches from network,
 * caches the result, and returns it.
 *
 * If the network call fails and stale cache exists, returns stale data.
 */
export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL_MS,
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss – fetch from network
  try {
    const data = await fetcher();
    await cacheSet(key, data, ttl);
    return data;
  } catch (error) {
    // Network failed – try returning stale cache (ignore TTL)
    try {
      const raw = await AsyncStorage.getItem(cacheKey(key));
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        if (__DEV__) {
          console.warn(`[OfflineStorage] Returning stale cache for "${key}"`);
        }
        return entry.data;
      }
    } catch {
      // ignore
    }
    throw error;
  }
}

// ============================================================
// MARK: - Internal Helpers
// ============================================================

function pruneExpired(metadata: CacheMetadata[], now: number): CacheMetadata[] {
  const expired: string[] = [];
  const valid: CacheMetadata[] = [];

  for (const m of metadata) {
    if (now - m.createdAt > m.ttl) {
      expired.push(m.key);
    } else {
      valid.push(m);
    }
  }

  if (expired.length > 0) {
    // Fire-and-forget removal
    void AsyncStorage.multiRemove(expired.map(cacheKey));
  }

  return valid;
}
