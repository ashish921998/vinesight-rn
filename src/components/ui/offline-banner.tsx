/**
 * Offline Banner
 * Displays a banner at the top of the screen when the device is offline.
 * Includes sync status indicator and last-synced timestamp.
 */

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '@/stores/network-store';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing, borderRadius } from '@/styles/theme';

// ============================================================
// MARK: - Offline Banner
// ============================================================

export function OfflineBanner() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const slideAnim = useRef(new Animated.Value(isConnected ? -80 : 0)).current;
  const m3 = useM3();

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? -80 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: m3.colorScheme.errorContainer,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents={isConnected ? 'none' : 'auto'}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={m3.colorScheme.onErrorContainer} />
      <Text style={[styles.bannerText, { color: m3.colorScheme.onErrorContainer }]}>
        You are offline
      </Text>
      <Text style={[styles.bannerSubtext, { color: m3.colorScheme.onErrorContainer }]}>
        Changes will sync when connected
      </Text>
    </Animated.View>
  );
}

// ============================================================
// MARK: - Sync Status Indicator
// ============================================================

export function SyncStatusIndicator() {
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const pendingCount = useNetworkStore((s) => s.pendingActionCount);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const syncNow = useNetworkStore((s) => s.syncNow);
  const m3 = useM3();

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      const animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      animation.start();
      return () => animation.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncing, spinAnim]);

  if (pendingCount === 0 && !isSyncing) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable
      onPress={() => {
        if (isConnected && !isSyncing) {
          void syncNow();
        }
      }}
      style={[
        styles.syncIndicator,
        {
          backgroundColor: isSyncing
            ? m3.colorScheme.primaryContainer
            : m3.colorScheme.secondaryContainer,
        },
      ]}
    >
      <Animated.View style={isSyncing ? { transform: [{ rotate: spin }] } : undefined}>
        <Ionicons
          name={isSyncing ? 'sync' : 'cloud-upload-outline'}
          size={16}
          color={
            isSyncing
              ? m3.colorScheme.onPrimaryContainer
              : m3.colorScheme.onSecondaryContainer
          }
        />
      </Animated.View>
      <Text
        style={[
          styles.syncText,
          {
            color: isSyncing
              ? m3.colorScheme.onPrimaryContainer
              : m3.colorScheme.onSecondaryContainer,
          },
        ]}
      >
        {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
      </Text>
    </Pressable>
  );
}

// ============================================================
// MARK: - Last Synced Timestamp
// ============================================================

export function LastSyncedTimestamp() {
  const lastSyncedAt = useNetworkStore((s) => s.lastSyncedAt);
  const m3 = useM3();

  if (!lastSyncedAt) return null;

  const formatTimestamp = (ts: number): string => {
    const now = Date.now();
    const diff = now - ts;

    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.lastSynced}>
      <Ionicons name="checkmark-circle-outline" size={14} color={m3.colorScheme.onSurfaceVariant} />
      <Text style={[styles.lastSyncedText, { color: m3.colorScheme.onSurfaceVariant }]}>
        Last synced: {formatTimestamp(lastSyncedAt)}
      </Text>
    </View>
  );
}

// ============================================================
// MARK: - Compact Offline Indicator (for headers / toolbars)
// ============================================================

export function OfflineIndicator() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const m3 = useM3();

  if (isConnected) return null;

  return (
    <View
      style={[
        styles.indicator,
        { backgroundColor: m3.colorScheme.errorContainer },
      ]}
    >
      <Ionicons name="cloud-offline" size={12} color={m3.colorScheme.onErrorContainer} />
      <Text style={[styles.indicatorText, { color: m3.colorScheme.onErrorContainer }]}>
        Offline
      </Text>
    </View>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[1],
  },
  bannerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  bannerSubtext: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    opacity: 0.8,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.full,
  },
  syncText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  lastSynced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  lastSyncedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.full,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
});
