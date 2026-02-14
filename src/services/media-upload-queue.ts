/**
 * Media Upload Queue for VineSight
 *
 * Queues media uploads (photos, attachments) when offline and
 * auto-uploads when connectivity returns. Integrates with the
 * existing sync queue from Phase 3.
 *
 * Phase 5 of offline functionality.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// ============================================================
// MARK: - Types
// ============================================================

/** Status of a queued upload */
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

/** A single queued media upload */
export interface QueuedUpload {
  /** Unique identifier for this upload */
  id: string;
  /** Local file path of the media to upload */
  localPath: string;
  /** Target storage bucket in Supabase */
  bucket: string;
  /** Target path within the bucket */
  storagePath: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** Current upload status */
  status: UploadStatus;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retries before marking as permanently failed */
  maxRetries: number;
  /** Error message if failed */
  errorMessage: string | null;
  /** Timestamp when queued */
  createdAt: number;
  /** Timestamp of last attempt */
  lastAttemptAt: number | null;
  /** Optional metadata (e.g., farm_id, record_id) */
  metadata: Record<string, string | number | boolean | null>;
}

/** Summary of the upload queue */
export interface UploadQueueSummary {
  /** Total items in queue */
  total: number;
  /** Items waiting to be uploaded */
  pending: number;
  /** Items currently uploading */
  uploading: number;
  /** Items that completed successfully */
  completed: number;
  /** Items that failed after max retries */
  failed: number;
  /** Total bytes pending upload */
  pendingBytes: number;
}

/** Listener callback for queue changes */
type QueueChangeListener = (summary: UploadQueueSummary) => void;

// ============================================================
// MARK: - Constants
// ============================================================

const UPLOAD_QUEUE_KEY = '@vinesight/media-upload-queue';
const DEFAULT_MAX_RETRIES = 3;

// ============================================================
// MARK: - MediaUploadQueue
// ============================================================

class MediaUploadQueue {
  private queue: Map<string, QueuedUpload> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private processing = false;
  private listeners: Set<QueueChangeListener> = new Set();

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
      if (raw) {
        const items: QueuedUpload[] = JSON.parse(raw);
        for (const item of items) {
          // Reset any items that were "uploading" when app closed
          if (item.status === 'uploading') {
            item.status = 'pending';
          }
          this.queue.set(item.id, item);
        }
      }
      this.initialized = true;
    } catch (error) {
      if (__DEV__) {
        console.error('[UploadQueue] Initialization failed:', error);
      }
      this.initialized = true;
    }
  }

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  private async persist(): Promise<void> {
    try {
      const items = Array.from(this.queue.values());
      await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(items));
    } catch (error) {
      if (__DEV__) {
        console.error('[UploadQueue] Failed to persist queue:', error);
      }
    }
  }

  // ----------------------------------------------------------
  // Listeners
  // ----------------------------------------------------------

  /** Subscribe to queue changes */
  subscribe(listener: QueueChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const summary = this.getSummarySync();
    for (const listener of this.listeners) {
      try {
        listener(summary);
      } catch {
        // ignore listener errors
      }
    }
  }

  // ----------------------------------------------------------
  // Queue Operations
  // ----------------------------------------------------------

  /**
   * Add a media file to the upload queue.
   * Returns the queue item ID.
   */
  async enqueue(params: {
    localPath: string;
    bucket: string;
    storagePath: string;
    mimeType: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<string> {
    await this.initialize();

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(params.localPath, { size: true });
    if (!fileInfo.exists) {
      throw new Error(`File not found: ${params.localPath}`);
    }

    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileSize = (fileInfo as { size?: number }).size ?? 0;

    const item: QueuedUpload = {
      id,
      localPath: params.localPath,
      bucket: params.bucket,
      storagePath: params.storagePath,
      mimeType: params.mimeType,
      fileSize,
      status: 'pending',
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      errorMessage: null,
      createdAt: Date.now(),
      lastAttemptAt: null,
      metadata: params.metadata ?? {},
    };

    this.queue.set(id, item);
    await this.persist();
    this.notifyListeners();

    return id;
  }

  /**
   * Process all pending uploads.
   * Call this when connectivity is restored.
   */
  async processQueue(): Promise<void> {
    await this.initialize();

    if (this.processing) return;
    this.processing = true;

    try {
      const pending = Array.from(this.queue.values()).filter(
        (item) => item.status === 'pending',
      );

      for (const item of pending) {
        await this.uploadItem(item);
      }
    } finally {
      this.processing = false;
    }
  }

  /** Upload a single queued item */
  private async uploadItem(item: QueuedUpload): Promise<void> {
    item.status = 'uploading';
    item.lastAttemptAt = Date.now();
    this.queue.set(item.id, item);
    this.notifyListeners();

    try {
      // Verify file still exists
      const fileInfo = await FileSystem.getInfoAsync(item.localPath);
      if (!fileInfo.exists) {
        item.status = 'failed';
        item.errorMessage = 'Local file no longer exists';
        this.queue.set(item.id, item);
        await this.persist();
        this.notifyListeners();
        return;
      }

      // Read file as base64 for Supabase upload
      const base64 = await FileSystem.readAsStringAsync(item.localPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from(item.bucket)
        .upload(item.storagePath, bytes.buffer, {
          contentType: item.mimeType,
          upsert: true,
        });

      if (error) throw error;

      item.status = 'completed';
      item.errorMessage = null;
      this.queue.set(item.id, item);
      await this.persist();
      this.notifyListeners();
    } catch (error) {
      item.retryCount += 1;
      item.errorMessage = error instanceof Error ? error.message : 'Upload failed';

      if (item.retryCount >= item.maxRetries) {
        item.status = 'failed';
      } else {
        item.status = 'pending';
      }

      this.queue.set(item.id, item);
      await this.persist();
      this.notifyListeners();
    }
  }

  /**
   * Retry a specific failed upload.
   */
  async retryUpload(id: string): Promise<void> {
    await this.initialize();

    const item = this.queue.get(id);
    if (!item || item.status !== 'failed') return;

    item.status = 'pending';
    item.retryCount = 0;
    item.errorMessage = null;
    this.queue.set(id, item);
    await this.persist();
    this.notifyListeners();

    await this.uploadItem(item);
  }

  /**
   * Retry all failed uploads.
   */
  async retryAllFailed(): Promise<void> {
    await this.initialize();

    const failed = Array.from(this.queue.values()).filter(
      (item) => item.status === 'failed',
    );

    for (const item of failed) {
      item.status = 'pending';
      item.retryCount = 0;
      item.errorMessage = null;
      this.queue.set(item.id, item);
    }

    await this.persist();
    this.notifyListeners();
    await this.processQueue();
  }

  /**
   * Remove a completed or failed upload from the queue.
   */
  async remove(id: string): Promise<void> {
    await this.initialize();

    this.queue.delete(id);
    await this.persist();
    this.notifyListeners();
  }

  /**
   * Clear all completed uploads from the queue.
   */
  async clearCompleted(): Promise<void> {
    await this.initialize();

    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'completed') {
        this.queue.delete(id);
      }
    }

    await this.persist();
    this.notifyListeners();
  }

  // ----------------------------------------------------------
  // Query
  // ----------------------------------------------------------

  /** Get all queued uploads */
  async getAll(): Promise<QueuedUpload[]> {
    await this.initialize();
    return Array.from(this.queue.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Get a specific upload by ID */
  async getById(id: string): Promise<QueuedUpload | null> {
    await this.initialize();
    return this.queue.get(id) ?? null;
  }

  /** Get queue summary */
  async getSummary(): Promise<UploadQueueSummary> {
    await this.initialize();
    return this.getSummarySync();
  }

  /** Synchronous summary (for internal use after init) */
  private getSummarySync(): UploadQueueSummary {
    let pending = 0;
    let uploading = 0;
    let completed = 0;
    let failed = 0;
    let pendingBytes = 0;

    for (const item of this.queue.values()) {
      switch (item.status) {
        case 'pending':
          pending++;
          pendingBytes += item.fileSize;
          break;
        case 'uploading':
          uploading++;
          pendingBytes += item.fileSize;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      total: this.queue.size,
      pending,
      uploading,
      completed,
      failed,
      pendingBytes,
    };
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

/** Default media upload queue instance */
export const mediaUploadQueue = new MediaUploadQueue();

export { MediaUploadQueue };
