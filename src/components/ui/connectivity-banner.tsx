/**
 * Connectivity Banner
 *
 * Displays a banner when the app is offline, showing the number of
 * pending mutations and sync status. Provides visual feedback when
 * syncing completes.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivityStore } from '@/stores/connectivity-store';
import { useM3 } from '@/styles/use-theme';

// ============================================================
// MARK: - Component
// ============================================================

export function ConnectivityBanner() {
  const insets = useSafeAreaInsets();
  const m3 = useM3();

  const isConnected = useConnectivityStore((s) => s.isConnected);
  const isReady = useConnectivityStore((s) => s.isReady);
  const pendingCount = useConnectivityStore((s) => s.pendingCount);
  const isSyncing = useConnectivityStore((s) => s.isSyncing);
  const failedCount = useConnectivityStore((s) => s.failedCount);
  const bannerDismissed = useConnectivityStore((s) => s.bannerDismissed);
  const dismissBanner = useConnectivityStore((s) => s.dismissBanner);
  const triggerSync = useConnectivityStore((s) => s.triggerSync);

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const prevPendingRef = useRef(pendingCount);

  // Determine if banner should be visible
  const shouldShow =
    isReady && !bannerDismissed && (!isConnected || pendingCount > 0 || showSyncComplete);

  // Detect sync completion
  useEffect(() => {
    if (prevPendingRef.current > 0 && pendingCount === 0 && isConnected && !isSyncing) {
      setShowSyncComplete(true);
      const timer = setTimeout(() => {
        setShowSyncComplete(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, isConnected, isSyncing]);

  // Animate banner in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -100,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [shouldShow, slideAnim]);

  if (!isReady) return null;

  // Determine banner content and colors
  let backgroundColor: string;
  let textColor: string;
  let message: string;
  let showActivity = false;

  if (!isConnected) {
    backgroundColor = m3.colorScheme.errorContainer;
    textColor = m3.colorScheme.onErrorContainer;
    message =
      pendingCount > 0
        ? `Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`
        : 'You are offline';
  } else if (isSyncing) {
    backgroundColor = m3.colorScheme.tertiaryContainer;
    textColor = m3.colorScheme.onTertiaryContainer;
    message = `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}…`;
    showActivity = true;
  } else if (showSyncComplete) {
    backgroundColor = m3.colorScheme.primaryContainer;
    textColor = m3.colorScheme.onPrimaryContainer;
    message = 'All changes synced ✓';
  } else if (failedCount > 0) {
    backgroundColor = m3.colorScheme.errorContainer;
    textColor = m3.colorScheme.onErrorContainer;
    message = `${failedCount} change${failedCount !== 1 ? 's' : ''} failed to sync`;
  } else if (pendingCount > 0) {
    backgroundColor = m3.colorScheme.secondaryContainer;
    textColor = m3.colorScheme.onSecondaryContainer;
    message = `${pendingCount} change${pendingCount !== 1 ? 's' : ''} waiting to sync`;
  } else {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingTop: Platform.OS === 'ios' ? insets.top : 4,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        <View style={styles.messageRow}>
          {showActivity && (
            <ActivityIndicator
              size="small"
              color={textColor}
              style={styles.spinner}
            />
          )}
          <Text style={[styles.messageText, { color: textColor }]} numberOfLines={1}>
            {message}
          </Text>
        </View>

        <View style={styles.actions}>
          {isConnected && pendingCount > 0 && !isSyncing && (
            <Pressable
              onPress={() => void triggerSync()}
              style={[styles.actionButton, { borderColor: textColor }]}
              accessibilityLabel="Sync now"
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, { color: textColor }]}>Sync</Text>
            </Pressable>
          )}

          <Pressable
            onPress={dismissBanner}
            style={styles.dismissButton}
            accessibilityLabel="Dismiss banner"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.dismissText, { color: textColor }]}>✕</Text>
          </Pressable>
        </View>
      </View>
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
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spinner: {
    marginRight: 8,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
