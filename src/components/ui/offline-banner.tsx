/**
 * OfflineBanner
 *
 * A subtle banner displayed at the top of the app when the device is offline
 * or when there are pending sync changes. Shows connectivity status and
 * pending change count.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing, borderRadius } from '@/styles/theme';

interface OfflineBannerProps {
  /** Optional style override for the container */
  style?: ViewStyle;
}

/**
 * A compact banner that shows offline/sync status.
 * Renders nothing when online and fully synced.
 *
 * States:
 * - Offline with pending changes: amber/warning banner
 * - Offline without pending changes: subtle gray banner
 * - Online but syncing: subtle info banner
 * - Online with pending changes: subtle info banner
 * - Online and synced: hidden
 *
 * Usage:
 * ```tsx
 * <OfflineBanner />
 * ```
 */
export function OfflineBanner({ style }: OfflineBannerProps) {
  const { isOfflineCapable, isConnected, isSyncing, pendingChanges, statusLabel } =
    useSyncStatus();

  // Don't show anything when PowerSync is not configured or when fully synced and online
  if (!isOfflineCapable) return null;
  if (isConnected && !isSyncing && pendingChanges === 0) return null;

  const m3 = useM3();

  // Determine banner colors based on state
  const isOffline = !isConnected;
  const backgroundColor = isOffline
    ? m3.colorScheme.errorContainer
    : m3.colorScheme.tertiaryContainer;
  const textColor = isOffline
    ? m3.colorScheme.onErrorContainer
    : m3.colorScheme.onTertiaryContainer;

  const icon = isOffline ? '⚡' : isSyncing ? '↻' : '↑';

  return (
    <View
      style={[
        {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor,
          gap: spacing[2],
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={statusLabel}
    >
      <Text
        style={{
          fontSize: fontSize.sm,
          color: textColor,
        }}
      >
        {icon}
      </Text>
      <Text
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: textColor,
        }}
        numberOfLines={1}
      >
        {statusLabel}
      </Text>
    </View>
  );
}
