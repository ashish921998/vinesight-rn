/**
 * SyncStatusIndicator
 * Shows the sync status for an entity or the overall sync state.
 * Displays a small icon/badge with sync state information.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncEngine, offlineQueue } from '@/services/offline';
import type { SyncStatus } from '@/services/offline';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing } from '@/styles/theme';

// ============================================================
// MARK: - Types
// ============================================================

interface SyncStatusIndicatorProps {
  /** Entity type to track (if omitted, shows global sync status) */
  entityType?: string;
  /** Entity ID to track */
  entityId?: string | number;
  /** Whether to show the text label */
  showLabel?: boolean;
  /** Size of the icon */
  size?: number;
}

// ============================================================
// MARK: - Component
// ============================================================

export function SyncStatusIndicator({
  entityType,
  entityId,
  showLabel = false,
  size = 16,
}: SyncStatusIndicatorProps) {
  const m3 = useM3();
  const [status, setStatus] = useState<SyncStatus['state'] | 'idle'>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (entityType && entityId) {
      // Track specific entity
      const unsubscribe = syncEngine.subscribe((statuses) => {
        const key = `${entityType}:${entityId}`;
        const entityStatus = statuses.get(key);
        setStatus(entityStatus?.state ?? 'synced');
      });
      return unsubscribe;
    }

    // Track global sync status
    const unsubscribeSync = syncEngine.subscribe(() => {
      if (syncEngine.isSyncing()) {
        setStatus('syncing');
      } else if (syncEngine.hasPendingSyncs()) {
        setStatus('pending');
      } else {
        setStatus('synced');
      }
    });

    const unsubscribeQueue = offlineQueue.subscribe((queue) => {
      setPendingCount(queue.filter((m) => m.status === 'pending').length);
    });

    return () => {
      unsubscribeSync();
      unsubscribeQueue();
    };
  }, [entityType, entityId]);

  const getIconAndColor = useCallback((): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
  } => {
    switch (status) {
      case 'synced':
        return {
          icon: 'checkmark-circle',
          color: m3.colorScheme.primary,
          label: 'Synced',
        };
      case 'pending':
        return {
          icon: 'time-outline',
          color: m3.colorScheme.warning,
          label: pendingCount > 0 ? `${pendingCount} pending` : 'Pending',
        };
      case 'syncing':
        return {
          icon: 'sync-outline',
          color: m3.colorScheme.primary,
          label: 'Syncing…',
        };
      case 'conflict':
        return {
          icon: 'alert-circle',
          color: m3.colorScheme.warning,
          label: 'Conflict',
        };
      case 'error':
        return {
          icon: 'close-circle',
          color: m3.colorScheme.error,
          label: 'Sync error',
        };
      default:
        return {
          icon: 'checkmark-circle-outline',
          color: m3.colorScheme.onSurfaceVariant,
          label: '',
        };
    }
  }, [status, pendingCount, m3]);

  // Don't render anything if synced and no label requested
  if (status === 'synced' && !showLabel && !entityType) {
    return null;
  }

  const { icon, color, label } = getIconAndColor();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={size} color={color} />
      {showLabel && label ? (
        <Text style={[styles.label, { color }]}>{label}</Text>
      ) : null}
    </View>
  );
}

// ============================================================
// MARK: - LastUpdatedText
// ============================================================

interface LastUpdatedTextProps {
  /** ISO timestamp of last update */
  timestamp: string | null;
  /** Prefix text */
  prefix?: string;
}

/**
 * Displays a "Last updated" timestamp in a human-readable format.
 */
export function LastUpdatedText({ timestamp, prefix = 'Last updated' }: LastUpdatedTextProps) {
  const m3 = useM3();

  if (!timestamp) return null;

  const formatRelativeTime = (isoString: string): string => {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;

    if (diffMs < 60_000) return 'just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <Text style={[styles.lastUpdated, { color: m3.colorScheme.onSurfaceVariant }]}>
      {prefix} {formatRelativeTime(timestamp)}
    </Text>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  lastUpdated: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
  },
});

export default SyncStatusIndicator;
