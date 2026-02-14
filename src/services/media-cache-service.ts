/**
 * Media Cache Service for VineSight
 *
 * Provides offline media/asset caching with LRU eviction, prefetching,
 * and cache invalidation. Uses expo-file-system for local storage.
 *
 * Phase 5 of offline functionality.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// MARK: - Types
// ============================================================

/** Metadata for a single cached asset */
export interface CacheEntry {
  /** Original remote URL */
  uri: string;
  /** Local file path on device */
  localPath: string;
  /** File size in bytes */
  size: number;
  /** Timestamp of last access (for LRU) */
  lastAccessedAt: number;
  /** Timestamp when cached */
  cachedAt: number;
  /** ETag or last-modified header for invalidation */
  etag: string | null;
  /** MIME type if known */
  mimeType: string | null;
}

/** Cache statistics */
export interface CacheStats {
  /** Total number of cached entries */
  entryCount: number;
  /** Total size of all cached files in bytes */
  totalSize: number;
  /** Maximum allowed cache size in bytes */
  maxSize: number;
  /** Percentage of cache used (0-100) */
  usagePercent: number;
}

/** Options for configuring the media cache */
export interface MediaCacheConfig {
  /** Maximum cache size in bytes (default: 200MB) */
  maxCacheSize?: number;
  /** Directory name within documentDirectory (default: 'media-cache') */
  cacheDirectoryName?: string;
}

// ============================================================
// MARK: - Constants
// ============================================================

const DEFAULT_MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200 MB
const DEFAULT_CACHE_DIR_NAME = 'media-cache';
const CACHE_MANIFEST_KEY = '@vinesight/media-cache-manifest';

// ============================================================
// MARK: - Helpers
// ============================================================

/**
 * Generate a deterministic filename from a URL.
 * Uses a simple hash to avoid filesystem-unsafe characters.
 */
function hashUri(uri: string): string {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  // Extract extension from URL (up to 5 chars, alphanumeric only)
  const extMatch = uri.match(/\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/);
  const ext = extMatch ? `.${extMatch[1]}` : '';
  return `${Math.abs(hash).toString(36)}${ext}`;
}

// ============================================================
// MARK: - MediaCacheService
// ============================================================

class MediaCacheService {
  private manifest: Map<string, CacheEntry> = new Map();
  private cacheDir: string;
  private maxCacheSize: number;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config?: MediaCacheConfig) {
    const dirName = config?.cacheDirectoryName ?? DEFAULT_CACHE_DIR_NAME;
    this.cacheDir = `${FileSystem.documentDirectory ?? ''}${dirName}/`;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  /** Ensure the cache directory exists and manifest is loaded */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }

      // Load manifest from AsyncStorage
      const raw = await AsyncStorage.getItem(CACHE_MANIFEST_KEY);
      if (raw) {
        const entries: CacheEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          this.manifest.set(entry.uri, entry);
        }
      }

      this.initialized = true;
    } catch (error) {
      if (__DEV__) {
        console.error('[MediaCache] Initialization failed:', error);
      }
      this.initialized = true; // Allow usage even if init partially fails
    }
  }

  // ----------------------------------------------------------
  // Manifest persistence
  // ----------------------------------------------------------

  private async persistManifest(): Promise<void> {
    try {
      const entries = Array.from(this.manifest.values());
      await AsyncStorage.setItem(CACHE_MANIFEST_KEY, JSON.stringify(entries));
    } catch (error) {
      if (__DEV__) {
        console.error('[MediaCache] Failed to persist manifest:', error);
      }
    }
  }

  // ----------------------------------------------------------
  // Core API
  // ----------------------------------------------------------

  /**
   * Get the local path for a cached asset, or null if not cached.
   * Updates the LRU access timestamp.
   */
  async getCachedUri(remoteUri: string): Promise<string | null> {
    await this.initialize();

    const entry = this.manifest.get(remoteUri);
    if (!entry) return null;

    // Verify file still exists on disk
    try {
      const info = await FileSystem.getInfoAsync(entry.localPath);
      if (!info.exists) {
        this.manifest.delete(remoteUri);
        await this.persistManifest();
        return null;
      }
    } catch {
      this.manifest.delete(remoteUri);
      await this.persistManifest();
      return null;
    }

    // Update LRU timestamp
    entry.lastAccessedAt = Date.now();
    this.manifest.set(remoteUri, entry);
    // Persist in background (non-blocking)
    void this.persistManifest();

    return entry.localPath;
  }

  /**
   * Download and cache a remote asset. Returns the local file path.
   * If already cached, returns the existing local path (with LRU update).
   */
  async cacheAsset(remoteUri: string): Promise<string> {
    await this.initialize();

    // Check if already cached
    const existing = await this.getCachedUri(remoteUri);
    if (existing) return existing;

    const filename = hashUri(remoteUri);
    const localPath = `${this.cacheDir}${filename}`;

    // Download the file
    const downloadResult = await FileSystem.downloadAsync(remoteUri, localPath);

    if (downloadResult.status !== 200) {
      // Clean up partial download
      try {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      } catch {
        // ignore cleanup errors
      }
      throw new Error(`Failed to download asset: HTTP ${downloadResult.status}`);
    }

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(localPath, { size: true });
    const fileSize = (fileInfo as { size?: number }).size ?? 0;

    // Create cache entry
    const entry: CacheEntry = {
      uri: remoteUri,
      localPath,
      size: fileSize,
      lastAccessedAt: Date.now(),
      cachedAt: Date.now(),
      etag: downloadResult.headers?.['etag'] ?? downloadResult.headers?.['ETag'] ?? null,
      mimeType: downloadResult.headers?.['content-type'] ?? null,
    };

    this.manifest.set(remoteUri, entry);

    // Evict if over size limit
    await this.evictIfNeeded();
    await this.persistManifest();

    return localPath;
  }

  /**
   * Prefetch multiple assets in parallel.
   * Returns an array of results (local paths or errors).
   */
  async prefetch(uris: string[]): Promise<Array<{ uri: string; localPath: string | null; error: string | null }>> {
    await this.initialize();

    const results = await Promise.allSettled(
      uris.map(async (uri) => {
        const localPath = await this.cacheAsset(uri);
        return { uri, localPath, error: null };
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        uri: uris[index],
        localPath: null,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    });
  }

  /**
   * Invalidate a cached asset (e.g., when server version changes).
   * Deletes the local file and removes from manifest.
   */
  async invalidate(remoteUri: string): Promise<void> {
    await this.initialize();

    const entry = this.manifest.get(remoteUri);
    if (!entry) return;

    try {
      await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
    } catch {
      // ignore deletion errors
    }

    this.manifest.delete(remoteUri);
    await this.persistManifest();
  }

  /**
   * Invalidate and re-download an asset if the server version has changed.
   * Compares ETags when available.
   */
  async refreshIfStale(remoteUri: string): Promise<string> {
    await this.initialize();

    const entry = this.manifest.get(remoteUri);

    if (entry?.etag) {
      try {
        // HEAD request to check if asset changed
        const response = await fetch(remoteUri, { method: 'HEAD' });
        const serverEtag = response.headers.get('etag');

        if (serverEtag && serverEtag === entry.etag) {
          // Asset hasn't changed, update LRU and return cached version
          entry.lastAccessedAt = Date.now();
          this.manifest.set(remoteUri, entry);
          void this.persistManifest();
          return entry.localPath;
        }
      } catch {
        // If HEAD request fails (e.g., offline), return cached version
        if (entry) return entry.localPath;
      }
    }

    // Either no cached version, no etag, or etag changed — re-download
    if (entry) {
      await this.invalidate(remoteUri);
    }
    return this.cacheAsset(remoteUri);
  }

  // ----------------------------------------------------------
  // LRU Eviction
  // ----------------------------------------------------------

  /** Evict least-recently-used entries until cache is within size limit */
  private async evictIfNeeded(): Promise<void> {
    let totalSize = this.getTotalSize();

    if (totalSize <= this.maxCacheSize) return;

    // Sort entries by lastAccessedAt ascending (oldest first)
    const sorted = Array.from(this.manifest.entries()).sort(
      ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt,
    );

    for (const [uri, entry] of sorted) {
      if (totalSize <= this.maxCacheSize) break;

      try {
        await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
      } catch {
        // ignore deletion errors
      }

      totalSize -= entry.size;
      this.manifest.delete(uri);
    }
  }

  // ----------------------------------------------------------
  // Cache Management
  // ----------------------------------------------------------

  /** Get total size of all cached files in bytes */
  private getTotalSize(): number {
    let total = 0;
    for (const entry of this.manifest.values()) {
      total += entry.size;
    }
    return total;
  }

  /** Get cache statistics */
  async getStats(): Promise<CacheStats> {
    await this.initialize();

    const totalSize = this.getTotalSize();
    return {
      entryCount: this.manifest.size,
      totalSize,
      maxSize: this.maxCacheSize,
      usagePercent: this.maxCacheSize > 0 ? Math.round((totalSize / this.maxCacheSize) * 100) : 0,
    };
  }

  /** Check if a URI is cached */
  async isCached(remoteUri: string): Promise<boolean> {
    await this.initialize();
    return this.manifest.has(remoteUri);
  }

  /** Clear the entire cache */
  async clearAll(): Promise<void> {
    await this.initialize();

    try {
      await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
    } catch (error) {
      if (__DEV__) {
        console.error('[MediaCache] Failed to clear cache directory:', error);
      }
    }

    this.manifest.clear();
    await this.persistManifest();
  }

  /** Update the maximum cache size and evict if necessary */
  async setMaxCacheSize(bytes: number): Promise<void> {
    this.maxCacheSize = bytes;
    await this.evictIfNeeded();
    await this.persistManifest();
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

/** Default media cache instance */
export const mediaCache = new MediaCacheService();

export { MediaCacheService };
