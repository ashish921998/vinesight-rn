/**
 * useOfflineMedia Hook
 *
 * Provides cache status, pending uploads, cache size info,
 * and methods to prefetch, clear cache, and retry failed uploads.
 *
 * Phase 5 of offline functionality.
 */

import { useCallback, useEffect, useState } from 'react';
import { mediaCache, type CacheStats } from '@/services/media-cache-service';
import {
  mediaUploadQueue,
  type UploadQueueSummary,
  type QueuedUpload,
} from '@/services/media-upload-queue';

// ============================================================
// MARK: - Types
// ============================================================

interface OfflineMediaState {
  /** Cache statistics */
  cacheStats: CacheStats;
  /** Upload queue summary */
  uploadSummary: UploadQueueSummary;
  /** All queued uploads */
  pendingUploads: QueuedUpload[];
  /** Whether the hook is still loading initial data */
  isLoading: boolean;
}

interface OfflineMediaActions {
  /** Prefetch a list of asset URIs into the cache */
  prefetch: (uris: string[]) => Promise<void>;
  /** Clear the entire media cache */
  clearCache: () => Promise<void>;
  /** Retry a specific failed upload */
  retryUpload: (id: string) => Promise<void>;
  /** Retry all failed uploads */
  retryAllFailed: () => Promise<void>;
  /** Process all pending uploads (call when online) */
  processUploads: () => Promise<void>;
  /** Enqueue a new media upload */
  enqueueUpload: (params: {
    localPath: string;
    bucket: string;
    storagePath: string;
    mimeType: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) => Promise<string>;
  /** Remove a completed or failed upload */
  removeUpload: (id: string) => Promise<void>;
  /** Clear all completed uploads */
  clearCompletedUploads: () => Promise<void>;
  /** Refresh cache stats and upload summary */
  refresh: () => Promise<void>;
  /** Check if a specific URI is cached */
  isCached: (uri: string) => Promise<boolean>;
  /** Invalidate a cached asset */
  invalidateAsset: (uri: string) => Promise<void>;
}

export type UseOfflineMediaReturn = OfflineMediaState & OfflineMediaActions;

// ============================================================
// MARK: - Default Values
// ============================================================

const DEFAULT_CACHE_STATS: CacheStats = {
  entryCount: 0,
  totalSize: 0,
  maxSize: 0,
  usagePercent: 0,
};

const DEFAULT_UPLOAD_SUMMARY: UploadQueueSummary = {
  total: 0,
  pending: 0,
  uploading: 0,
  completed: 0,
  failed: 0,
  pendingBytes: 0,
};

// ============================================================
// MARK: - Hook
// ============================================================

export function useOfflineMedia(): UseOfflineMediaReturn {
  const [cacheStats, setCacheStats] = useState<CacheStats>(DEFAULT_CACHE_STATS);
  const [uploadSummary, setUploadSummary] = useState<UploadQueueSummary>(DEFAULT_UPLOAD_SUMMARY);
  const [pendingUploads, setPendingUploads] = useState<QueuedUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ----------------------------------------------------------
  // Refresh data
  // ----------------------------------------------------------

  const refresh = useCallback(async () => {
    try {
      const [stats, summary, uploads] = await Promise.all([
        mediaCache.getStats(),
        mediaUploadQueue.getSummary(),
        mediaUploadQueue.getAll(),
      ]);
      setCacheStats(stats);
      setUploadSummary(summary);
      setPendingUploads(uploads);
    } catch (error) {
      if (__DEV__) {
        console.error('[useOfflineMedia] Failed to refresh:', error);
      }
    }
  }, []);

  // ----------------------------------------------------------
  // Initialize and subscribe to queue changes
  // ----------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await Promise.all([mediaCache.initialize(), mediaUploadQueue.initialize()]);
      if (mounted) {
        await refresh();
        setIsLoading(false);
      }
    };

    void init();

    // Subscribe to upload queue changes
    const unsubscribe = mediaUploadQueue.subscribe((summary) => {
      if (mounted) {
        setUploadSummary(summary);
        // Also refresh the full uploads list
        void mediaUploadQueue.getAll().then((uploads) => {
          if (mounted) setPendingUploads(uploads);
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refresh]);

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const prefetch = useCallback(
    async (uris: string[]) => {
      await mediaCache.prefetch(uris);
      await refresh();
    },
    [refresh],
  );

  const clearCache = useCallback(async () => {
    await mediaCache.clearAll();
    await refresh();
  }, [refresh]);

  const retryUpload = useCallback(async (id: string) => {
    await mediaUploadQueue.retryUpload(id);
  }, []);

  const retryAllFailed = useCallback(async () => {
    await mediaUploadQueue.retryAllFailed();
  }, []);

  const processUploads = useCallback(async () => {
    await mediaUploadQueue.processQueue();
  }, []);

  const enqueueUpload = useCallback(
    async (params: {
      localPath: string;
      bucket: string;
      storagePath: string;
      mimeType: string;
      metadata?: Record<string, string | number | boolean | null>;
    }) => {
      return mediaUploadQueue.enqueue(params);
    },
    [],
  );

  const removeUpload = useCallback(async (id: string) => {
    await mediaUploadQueue.remove(id);
  }, []);

  const clearCompletedUploads = useCallback(async () => {
    await mediaUploadQueue.clearCompleted();
  }, []);

  const isCached = useCallback(async (uri: string) => {
    return mediaCache.isCached(uri);
  }, []);

  const invalidateAsset = useCallback(
    async (uri: string) => {
      await mediaCache.invalidate(uri);
      await refresh();
    },
    [refresh],
  );

  return {
    // State
    cacheStats,
    uploadSummary,
    pendingUploads,
    isLoading,
    // Actions
    prefetch,
    clearCache,
    retryUpload,
    retryAllFailed,
    processUploads,
    enqueueUpload,
    removeUpload,
    clearCompletedUploads,
    refresh,
    isCached,
    invalidateAsset,
  };
}
