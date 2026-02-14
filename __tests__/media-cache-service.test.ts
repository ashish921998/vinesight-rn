/**
 * Tests for MediaCacheService
 * Phase 5 - Offline Media/Asset Caching
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Import after mocks
import { MediaCacheService } from '@/services/media-cache-service';

describe('MediaCacheService', () => {
  let service: MediaCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    service = new MediaCacheService({ maxCacheSize: 10 * 1024 * 1024 });
  });

  describe('initialize', () => {
    it('creates cache directory if it does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

      await service.initialize();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('media-cache/'),
        { intermediates: true },
      );
    });

    it('loads manifest from AsyncStorage', async () => {
      const entries = [
        {
          uri: 'https://example.com/img.jpg',
          localPath: 'file:///mock/documents/media-cache/abc.jpg',
          size: 1024,
          lastAccessedAt: Date.now(),
          cachedAt: Date.now(),
          etag: null,
          mimeType: 'image/jpeg',
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entries));

      await service.initialize();

      const cached = await service.getCachedUri('https://example.com/img.jpg');
      expect(cached).toBe('file:///mock/documents/media-cache/abc.jpg');
    });

    it('only initializes once even if called multiple times', async () => {
      await service.initialize();
      await service.initialize();

      // getInfoAsync called once for dir check during init
      expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCachedUri', () => {
    it('returns null for uncached URIs', async () => {
      const result = await service.getCachedUri('https://example.com/missing.jpg');
      expect(result).toBeNull();
    });

    it('returns null and cleans up if file no longer exists on disk', async () => {
      const entries = [
        {
          uri: 'https://example.com/gone.jpg',
          localPath: 'file:///mock/documents/media-cache/gone.jpg',
          size: 512,
          lastAccessedAt: Date.now(),
          cachedAt: Date.now(),
          etag: null,
          mimeType: null,
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(entries));

      await service.initialize();

      // First call for init dir check returns exists, second for file check returns not exists
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

      const result = await service.getCachedUri('https://example.com/gone.jpg');
      expect(result).toBeNull();
    });
  });

  describe('cacheAsset', () => {
    it('downloads and caches a remote asset', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'image/png', etag: '"abc123"' },
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 2048,
      });

      const localPath = await service.cacheAsset('https://example.com/photo.png');

      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        'https://example.com/photo.png',
        expect.stringContaining('media-cache/'),
      );
      expect(localPath).toContain('media-cache/');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('returns existing cached path without re-downloading', async () => {
      // First download
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });

      const path1 = await service.cacheAsset('https://example.com/cached.jpg');
      const path2 = await service.cacheAsset('https://example.com/cached.jpg');

      expect(path1).toBe(path2);
      expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
    });

    it('throws on failed download', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 404,
        headers: {},
      });

      await expect(service.cacheAsset('https://example.com/404.jpg')).rejects.toThrow(
        'Failed to download asset: HTTP 404',
      );
    });
  });

  describe('invalidate', () => {
    it('removes cached entry and deletes file', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 512,
      });

      await service.cacheAsset('https://example.com/remove-me.jpg');
      await service.invalidate('https://example.com/remove-me.jpg');

      expect(FileSystem.deleteAsync).toHaveBeenCalled();

      const cached = await service.getCachedUri('https://example.com/remove-me.jpg');
      expect(cached).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns correct cache statistics', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });

      await service.cacheAsset('https://example.com/a.jpg');
      await service.cacheAsset('https://example.com/b.jpg');

      const stats = await service.getStats();

      expect(stats.entryCount).toBe(2);
      expect(stats.totalSize).toBe(2048);
      expect(stats.maxSize).toBe(10 * 1024 * 1024);
      expect(stats.usagePercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearAll', () => {
    it('deletes cache directory and clears manifest', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 512,
      });

      await service.cacheAsset('https://example.com/clear-me.jpg');
      await service.clearAll();

      const stats = await service.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entries when cache exceeds max size', async () => {
      // Create a service with a very small max size (3KB)
      const smallService = new MediaCacheService({ maxCacheSize: 3072 });

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });

      // Each file is 2KB - after 2 files (4KB), eviction should trigger
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 2048,
      });

      await smallService.cacheAsset('https://example.com/old.jpg');

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      await smallService.cacheAsset('https://example.com/new.jpg');

      // The old entry should have been evicted
      const stats = await smallService.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(3072);
    });
  });

  describe('prefetch', () => {
    it('caches multiple assets and returns results', async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        headers: {},
      });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 512,
      });

      const results = await service.prefetch([
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].localPath).toBeTruthy();
      expect(results[0].error).toBeNull();
      expect(results[1].localPath).toBeTruthy();
      expect(results[1].error).toBeNull();
    });

    it('handles individual failures gracefully', async () => {
      (FileSystem.downloadAsync as jest.Mock)
        .mockResolvedValueOnce({ status: 200, headers: {} })
        .mockResolvedValueOnce({ status: 500, headers: {} });
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 512,
      });

      const results = await service.prefetch([
        'https://example.com/ok.jpg',
        'https://example.com/fail.jpg',
      ]);

      expect(results[0].error).toBeNull();
      expect(results[1].error).toBeTruthy();
    });
  });
});
