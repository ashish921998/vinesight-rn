/**
 * SyncStatusBadge – A compact indicator showing pending sync count,
 * sync-in-progress spinner, and success/failure states.
 *
 * Drop this into a header bar or as a floating element.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useSyncStore,
  selectPendingCount,
  selectFailedCount,
} from '@/stores/sync-store';
import { useM3 } from '@/styles/use-theme';
import { colors as baseColors, fontSize, fontWeight, spacing, borderRadius } from '@/styles/theme';

interface SyncStatusBadgeProps {
  /** Override the default size (default 28). */
  size?: number;
}

export function SyncStatusBadge({ size = 28 }: SyncStatusBadgeProps) {
  const m3 = useM3();
  const pendingCount = useSyncStore(selectPendingCount);
  const failedCount = useSyncStore(selectFailedCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncing, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Nothing to show when fully synced and no failures
  if (pendingCount === 0 && failedCount === 0 && !isSyncing) return null;

  // Determine icon & color
  let iconName: keyof typeof Ionicons.glyphMap = 'cloud-upload-outline';
  let badgeColor = m3.colorScheme.primary;
  let label = `${pendingCount}`;

  if (failedCount > 0) {
    iconName = 'cloud-offline-outline';
    badgeColor = baseColors.error;
    label = `${failedCount}`;
  } else if (isSyncing) {
    iconName = 'sync-outline';
  }

  return (
    <View
      style={[styles.container, { backgroundColor: badgeColor }]}
      accessibilityRole="status"
      accessibilityLabel={
        isSyncing
          ? 'Syncing changes'
          : failedCount > 0
            ? `${failedCount} sync failures`
            : `${pendingCount} changes pending sync`
      }
    >
      {isSyncing ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sync-outline" size={size * 0.55} color="#fff" />
        </Animated.View>
      ) : (
        <Ionicons name={iconName} size={size * 0.55} color="#fff" />
      )}
      {!isSyncing && (pendingCount > 0 || failedCount > 0) && (
        <Text style={styles.countText}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: 4,
    minWidth: 28,
    height: 28,
  },
  countText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
