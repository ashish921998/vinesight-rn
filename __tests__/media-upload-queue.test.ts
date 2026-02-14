/**
 * Tests for MediaUploadQueue
 * Phase 5 - Offline Media/Asset Caching
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

// Import after mocks
import { MediaUploadQueue } from '@/services/media-upload-queue';

describe('MediaUploadQueue', () => {
  let queue: MediaUploadQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1024 });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('dGVzdA=='); // base64 "test"

    queue = new MediaUploadQueue();
  });

  describe('enqueue', () => {
    it('adds an item to the queue', async () => {
      const id = await queue.enqueue({
        localPath: 'file:///mock/photo.jpg',
        bucket: 'farm-photos',
        storagePath: 'user123/photo.jpg',
        mimeType: 'image/jpeg',
      });

      expect(id).toBeTruthy();
      expect(id).toContain('upload_');

      const summary = await queue.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.pending).toBe(1);
    });

    it('throws if file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

      await expect(
        queue.enqueue({
          localPath: 'file:///mock/missing.jpg',
          bucket: 'farm-photos',
          storagePath: 'user123/missing.jpg',
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow('File not found');
    });

    it('persists queue to AsyncStorage', async () => {
      await queue.enqueue({
        localPath: 'file:///mock/photo.jpg',
        bucket: 'farm-photos',
        storagePath: 'user123/photo.jpg',
        mimeType: 'image/jpeg',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('returns correct summary counts', async () => {
      await queue.enqueue({
        localPath: 'file:///mock/a.jpg',
        bucket: 'photos',
        storagePath: 'a.jpg',
        mimeType: 'image/jpeg',
      });
      await queue.enqueue({
        localPath: 'file:///mock/b.jpg',
        bucket: 'photos',
        storagePath: 'b.jpg',
        mimeType: 'image/jpeg',
      });

      const summary = await queue.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.pending).toBe(2);
      expect(summary.pendingBytes).toBe(2048);
    });
  });

  describe('getAll', () => {
    it('returns items sorted by creation time (newest first)', async () => {
      await queue.enqueue({
        localPath: 'file:///mock/first.jpg',
        bucket: 'photos',
        storagePath: 'first.jpg',
        mimeType: 'image/jpeg',
      });

      await new Promise((r) => setTimeout(r, 10));

      await queue.enqueue({
        localPath: 'file:///mock/second.jpg',
        bucket: 'photos',
        storagePath: 'second.jpg',
        mimeType: 'image/jpeg',
      });

      const all = await queue.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].storagePath).toBe('second.jpg');
      expect(all[1].storagePath).toBe('first.jpg');
    });
  });

  describe('remove', () => {
    it('removes an item from the queue', async () => {
      const id = await queue.enqueue({
        localPath: 'file:///mock/remove-me.jpg',
        bucket: 'photos',
        storagePath: 'remove-me.jpg',
        mimeType: 'image/jpeg',
      });

      await queue.remove(id);

      const summary = await queue.getSummary();
      expect(summary.total).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on queue changes', async () => {
      const listener = jest.fn();
      const unsubscribe = queue.subscribe(listener);

      await queue.enqueue({
        localPath: 'file:///mock/notify.jpg',
        bucket: 'photos',
        storagePath: 'notify.jpg',
        mimeType: 'image/jpeg',
      });

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ total: 1, pending: 1 }),
      );

      unsubscribe();
    });

    it('stops notifying after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = queue.subscribe(listener);
      unsubscribe();

      await queue.enqueue({
        localPath: 'file:///mock/silent.jpg',
        bucket: 'photos',
        storagePath: 'silent.jpg',
        mimeType: 'image/jpeg',
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('restores queue from AsyncStorage and resets uploading items to pending', async () => {
      const savedItems = [
        {
          id: 'upload_1',
          localPath: 'file:///mock/a.jpg',
          bucket: 'photos',
          storagePath: 'a.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          status: 'uploading', // was uploading when app closed
          retryCount: 0,
          maxRetries: 3,
          errorMessage: null,
          createdAt: Date.now(),
          lastAttemptAt: Date.now(),
          metadata: {},
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(savedItems));

      const restoredQueue = new MediaUploadQueue();
      const summary = await restoredQueue.getSummary();

      // Should be reset to pending
      expect(summary.pending).toBe(1);
      expect(summary.uploading).toBe(0);
    });
  });

  describe('clearCompleted', () => {
    it('removes only completed items', async () => {
      // We need to manually set up items with different statuses
      // by using the persisted state approach
      const items = [
        {
          id: 'upload_done',
          localPath: 'file:///mock/done.jpg',
          bucket: 'photos',
          storagePath: 'done.jpg',
          mimeType: 'image/jpeg',
          fileSize: 512,
          status: 'completed',
          retryCount: 0,
          maxRetries: 3,
          errorMessage: null,
          createdAt: Date.now(),
          lastAttemptAt: Date.now(),
          metadata: {},
        },
        {
          id: 'upload_pending',
          localPath: 'file:///mock/pending.jpg',
          bucket: 'photos',
          storagePath: 'pending.jpg',
          mimeType: 'image/jpeg',
          fileSize: 512,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          errorMessage: null,
          createdAt: Date.now(),
          lastAttemptAt: null,
          metadata: {},
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(items));

      const q = new MediaUploadQueue();
      await q.clearCompleted();

      const summary = await q.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.completed).toBe(0);
    });
  });
});
