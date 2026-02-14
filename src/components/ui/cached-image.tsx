/**
 * CachedImage - Offline-aware image component
 *
 * Loads images from local cache when available, downloads and caches
 * when online, and shows placeholder/fallback when unavailable.
 *
 * Phase 5 of offline functionality.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  View,
  ActivityIndicator,
  StyleSheet,
  type ImageStyle,
  type ViewStyle,
  type ImageResizeMode,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaCache } from '@/services/media-cache-service';
import { useThemeColors } from '@/styles/use-theme';

// ============================================================
// MARK: - Types
// ============================================================

interface CachedImageProps {
  /** Remote URI of the image */
  uri: string;
  /** Image style */
  style?: ImageStyle;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Resize mode (default: 'cover') */
  resizeMode?: ImageResizeMode;
  /** Custom placeholder component */
  placeholder?: React.ReactNode;
  /** Custom error/fallback component */
  fallback?: React.ReactNode;
  /** Icon name for default placeholder (default: 'image-outline') */
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  /** Size of the placeholder icon (default: 32) */
  placeholderIconSize?: number;
  /** Whether to show loading indicator (default: true) */
  showLoadingIndicator?: boolean;
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: (error: string) => void;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

// ============================================================
// MARK: - Component
// ============================================================

export function CachedImage({
  uri,
  style,
  containerStyle,
  resizeMode = 'cover',
  placeholder,
  fallback,
  placeholderIcon = 'image-outline',
  placeholderIconSize = 32,
  showLoadingIndicator = true,
  onLoad,
  onError,
}: CachedImageProps) {
  const colors = useThemeColors();
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [localUri, setLocalUri] = useState<string | null>(null);

  const loadImage = useCallback(async () => {
    if (!uri) {
      setLoadState('error');
      return;
    }

    setLoadState('loading');

    try {
      // First check cache
      const cached = await mediaCache.getCachedUri(uri);
      if (cached) {
        setLocalUri(cached);
        setLoadState('loaded');
        onLoad?.();
        return;
      }

      // Try to download and cache
      const path = await mediaCache.cacheAsset(uri);
      setLocalUri(path);
      setLoadState('loaded');
      onLoad?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load image';
      setLoadState('error');
      onError?.(message);
    }
  }, [uri, onLoad, onError]);

  useEffect(() => {
    void loadImage();
  }, [loadImage]);

  // Loading state
  if (loadState === 'loading' || loadState === 'idle') {
    if (placeholder) {
      return <View style={[styles.container, containerStyle]}>{placeholder}</View>;
    }

    return (
      <View
        style={[
          styles.container,
          styles.placeholder,
          { backgroundColor: colors.gray[100] },
          containerStyle,
          style,
        ]}
      >
        {showLoadingIndicator && (
          <ActivityIndicator size="small" color={colors.gray[400]} />
        )}
      </View>
    );
  }

  // Error state
  if (loadState === 'error' || !localUri) {
    if (fallback) {
      return <View style={[styles.container, containerStyle]}>{fallback}</View>;
    }

    return (
      <View
        style={[
          styles.container,
          styles.placeholder,
          { backgroundColor: colors.gray[100] },
          containerStyle,
          style,
        ]}
      >
        <Ionicons
          name={placeholderIcon}
          size={placeholderIconSize}
          color={colors.gray[300]}
        />
      </View>
    );
  }

  // Loaded state
  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri: localUri }}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        onError={() => {
          setLoadState('error');
          onError?.('Image render failed');
        }}
      />
    </View>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
