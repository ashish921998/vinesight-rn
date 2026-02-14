/**
 * Sync Status Bar
 * A subtle UI indicator showing the current sync status and pending offline changes.
 * Appears at the top of the screen when there are pending changes or sync issues.
 */

import { useEffect, useRef } from 'react';
import { Text, Animated, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncStore } from '@/stores/sync-store';
import { useNetworkStore } from '@/stores/network-store';
import { processSyncQueue } from '@/services/sync-processor';
import { retryFailedItems } from '@/services/sync-queue-service';
import type { SyncStatus } from '@/types/sync';

// ============================================================
// MARK: - Status Config
// ============================================================

interface StatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  backgroundColor: string;
  textColor: string;
}

function getStatusConfig(status: SyncStatus, pendingCount: number): StatusConfig {
  switch (status) {
    case 'synced':
      return {
        icon: 'checkmark-circle',
        label: 'All changes synced',
        backgroundColor: '#E8F5E9',
        textColor: '#2E7D32',
      };
    case 'syncing':
      return {
        icon: 'sync',
        label: 'Syncing changes…',
        backgroundColor: '#E3F2FD',
        textColor: '#1565C0',
      };
    case 'pending':
      return {
        icon: 'cloud-upload-outline',
        label: `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`,
        backgroundColor: '#FFF3E0',
        textColor: '#E65100',
      };
    case 'error':
      return {
        icon: 'alert-circle',
        label: 'Some changes failed to sync',
        backgroundColor: '#FFEBEE',
        textColor: '#C62828',
      };
    case 'offline':
      return {
        icon: 'cloud-offline-outline',
        label: pendingCount > 0
          ? `Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`
          : 'You are offline',
        backgroundColor: '#F5F5F5',
        textColor: '#616161',
      };
  }
}

// ============================================================
// MARK: - Component
// ============================================================

export function SyncStatusBar() {
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const failedCount = useSyncStore((s) => s.failedCount);
  const isConnected = useNetworkStore((s) => s.isConnected);

  const slideAnim = useRef(new Animated.Value(-50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Determine if the bar should be visible
  const shouldShow = status !== 'synced';

  useEffect(() => {
    if (shouldShow) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Auto-hide after showing "synced" briefly
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -50,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [shouldShow, slideAnim, opacityAnim]);

  const config = getStatusConfig(status, pendingCount);

  const handlePress = async () => {
    if (status === 'error' && isConnected) {
      // Retry failed items
      await retryFailedItems();
      await processSyncQueue();
    } else if (status === 'pending' && isConnected) {
      // Manually trigger sync
      await processSyncQueue();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents={shouldShow ? 'auto' : 'none'}
    >
      <Pressable style={styles.content} onPress={handlePress}>
        <Ionicons name={config.icon} size={16} color={config.textColor} />
        <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
        {failedCount > 0 && status === 'error' && (
          <Text style={[styles.retryHint, { color: config.textColor }]}>Tap to retry</Text>
        )}
        {status === 'pending' && isConnected && (
          <Text style={[styles.retryHint, { color: config.textColor }]}>Tap to sync</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  retryHint: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
    marginLeft: 4,
  },
});
